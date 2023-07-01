// Your web app's Firebase configuration
var firebaseConfig = {
  apiKey: "AIzaSyDPKjpimOZLKwNwfm_IQFm8X4Pv2ZgucIA",
  authDomain: "the-list-175d3.firebaseapp.com",
  databaseURL: "https://the-list-175d3-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "the-list-175d3",
  storageBucket: "the-list-175d3.appspot.com",
  messagingSenderId: "133562798111",
  appId: "1:133562798111:web:34a18cd64c6202314cc52a"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
var db = firebase.database();
var itemListElement = document.getElementById('item-list');
var totalElement = document.getElementById('total');

// Function to display the item list
function displayItemList() {
  var itemListRef = db.ref('items');

  itemListRef.on('value', function(snapshot) {
    var items = snapshot.val();
    itemListElement.innerHTML = '';

    try {
      for (var itemKey in items) {
        if (items.hasOwnProperty(itemKey)) {
          var item = items[itemKey];

          var itemCard = document.createElement('div');
          itemCard.classList.add('item-card');

          var itemName = document.createElement('a');
          itemName.textContent = item.name;
          itemName.href = 'item.html#' + encodeURIComponent(item.name);

          var itemCount = document.createElement('p');
          itemCount.textContent = 'Count: ' + item.count;

          var editButton = document.createElement('button');
          editButton.textContent = 'Edit';
          editButton.addEventListener('click', createEditItemHandler(itemKey));

          var deleteButton = document.createElement('button');
          deleteButton.textContent = 'Delete';
          deleteButton.addEventListener('click', createDeleteItemHandler(itemKey));

          itemCard.appendChild(itemName);
          itemCard.appendChild(itemCount);

          if (itemListElement === adminItemListElement) {
            itemCard.appendChild(editButton);
            itemCard.appendChild(deleteButton);
          }

          itemListElement.appendChild(itemCard);
        }
      }

      // Update the total count
      totalElement.textContent = Object.keys(items).length;
    } catch (e) {
      console.error(e);
    }
  });
}

// Helper function to create the edit item handler with a specific item key
function createEditItemHandler(itemKey) {
  return function() {
    editItem(itemKey);
  };
}

// Helper function to create the delete item handler with a specific item key
function createDeleteItemHandler(itemKey) {
  return function() {
    deleteItem(itemKey);
  };
}

// Add an event listener for the form submission
var newItemForm = document.getElementById('new-item-form');
newItemForm.addEventListener('submit', function(event) {
  event.preventDefault(); // Prevent the form from submitting and refreshing the page

  // Get the input values
  var itemName = document.getElementById('item-name').value;
  var itemCount = parseInt(document.getElementById('item-count').value);
  var itemImage = document.getElementById('item-image').value;
  var itemDescription = document.getElementById('item-description').value;

  // Create a new item object
  var newItem = {
    name: itemName,
    count: itemCount,
    image: itemImage,
    description: itemDescription
  };

  // Save the new item to Firebase
  var newItemRef = db.ref('items').push();
  newItemRef.set(newItem)
    .then(function() {
      console.log('New item added successfully');
      newItemForm.reset(); // Reset the form fields
    })
    .catch(function(error) {
      console.error('Error adding new item:', error);
    });
});

// Listen for changes in the items data and update the item list
db.ref('items').on('value', function(snapshot) {
  var items = [];

  snapshot.forEach(function(childSnapshot) {
    var item = childSnapshot.val();
    items.push(item);
  });

  displayItemList(items);
});

// Load the item content based on the URL hash
window.addEventListener('DOMContentLoaded', function() {
  var itemHash = window.location.hash.substr(1);
  var itemName = decodeURIComponent(itemHash);

  db.ref('items')
    .orderByChild('name')
    .equalTo(itemName)
    .limitToFirst(1)
    .once('value')
    .then(function(snapshot) {
      if (!snapshot.exists()) {
        // Handle invalid or non-existing item names
        console.log('Item not found: ' + itemName);
      } else {
        var item = Object.values(snapshot.val())[0];
        updateItemPage(item);
      }
    })
    .catch(function(error) {
      console.log('Error getting item:', error);
    });
});

// Call the displayItemList function to populate the item list on the index.html page
db.ref('items').once('value', function(snapshot) {
  var items = [];

  snapshot.forEach(function(childSnapshot) {
    var item = childSnapshot.val();
    items.push(item);
  });

  displayItemList(items);
});

// Function to handle editing an item
function editItem(key, item) {
  var newName = prompt('Enter a new name:', item.name);
  var newCount = parseInt(prompt('Enter a new count:', item.count), 10);
  var newImage = prompt('Enter a new image URL:', item.image);
  var newDescription = prompt('Enter a new description:', item.description);

  if (newName && !isNaN(newCount) && newImage && newDescription) {
    var updates = {};
    updates['items/' + key + '/name'] = newName;
    updates['items/' + key + '/count'] = newCount;
    updates['items/' + key + '/image'] = newImage;
    updates['items/' + key + '/description'] = newDescription;

    db.ref().update(updates);
  }
}


// Function to handle deleting an item
function deleteItem(key) {
  if (confirm('Are you sure you want to delete this item?')) {
    db.ref('items/' + key).remove();
  }
}
