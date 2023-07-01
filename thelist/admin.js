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
  db.ref('items').on('value', function (snapshot) {
    itemListElement.innerHTML = '';

    try {
      snapshot.forEach(function (childSnapshot) {
        var item = childSnapshot.val();
        var itemKey = childSnapshot.key; // Retrieve the key of the item

        var itemCard = document.createElement('div');
        itemCard.classList.add('item-card');

        var itemName = document.createElement('a');
        itemName.textContent = item.name;
        itemName.href = 'item.html#' + encodeURIComponent(item.name);

        var itemVersion = document.createElement('a');
        itemVersion.textContent = item.version;

        var itemCount = document.createElement('p');
        itemCount.textContent = 'Count: ' + item.count;

        var editButton = document.createElement('button');
        editButton.textContent = 'Edit';
        editButton.addEventListener('click', function () {
          editItem(itemKey, item); // Pass the key and item to the edit function
        });

        var deleteButton = document.createElement('button');
        deleteButton.textContent = 'Delete';
        deleteButton.addEventListener('click', function () {
          deleteItem(itemKey); // Pass the key to the delete function
        });

        itemCard.appendChild(itemName);
        itemCard.appendChild(itemVersion);
        itemCard.appendChild(itemCount);
        itemCard.appendChild(editButton);
        itemCard.appendChild(deleteButton);
        itemListElement.appendChild(itemCard);
      });

      totalElement.textContent = snapshot.numChildren();
    } catch (e) {
      console.error(e);
    }
  });
}

// Add an event listener for the form submission
var newItemForm = document.getElementById('new-item-form');
newItemForm.addEventListener('submit', function(event) {
  event.preventDefault(); // Prevent the form from submitting and refreshing the page

  // Get the input values
  var itemName = document.getElementById('item-name').value;
  var itemVersion = document.getElementById('item-version').value;
  var itemCount = parseInt(document.getElementById('item-count').value);
  var itemImage = document.getElementById('item-image').value;
  var itemDescription = document.getElementById('item-description').value;

// Create a new item object
var newItem = {
  count: itemCount,
  image: itemImage,
  description: itemDescription
};

// Save the new item to Firebase
var itemRef = db.ref('items').child(itemName); // Reference the item by name
itemRef.child(itemVersion).set(newItem)
  .then(function() {
    console.log('New item added successfully');
    newItemForm.reset(); // Reset the form fields
  })
  .catch(function(error) {
    console.error('Error adding new item:', error);
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
  var newVersion = prompt('Enter a new version:', item.version);
  var newCount = parseInt(prompt('Enter a new count:', item.count), 10);
  var newImage = prompt('Enter a new image URL:', item.image);
  var newDescription = prompt('Enter a new description:', item.description);

  if (newName && !isNaN(newCount) && newImage && newDescription) {
    var updates = {};
    updates['items/' + key + '/name'] = newName;
    updates['items/' + key + '/version'] = newVersion;
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