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
  itemListElement.innerHTML = '';

  try {
    snapshot.forEach(function(childSnapshot) {
      var item = childSnapshot.val();
      var itemId = childSnapshot.key; // Get the unique item ID

      var itemCard = document.createElement('div');
      itemCard.classList.add('item-card');

      var itemName = document.createElement('a');
      itemName.textContent = item.name;
      itemName.href = 'item.html#' + encodeURIComponent(item.name);

      var itemCount = document.createElement('p');
      itemCount.textContent = 'Count: ' + item.count;

      // Add an edit button
      var editButton = document.createElement('button');
      editButton.textContent = 'Edit';
      editButton.addEventListener('click', function() {
        // Prompt the user to update the item count
        var newCount = prompt('Enter the new count for ' + item.name);
        if (newCount !== null && !isNaN(newCount)) {
          // Update the item count in the database
          db.ref('items/' + itemId + '/count').set(parseInt(newCount))
            .then(function() {
              console.log('Item count updated successfully');
            })
            .catch(function(error) {
              console.error('Error updating item count:', error);
            });
        }
      });

      // Add a delete button
      var deleteButton = document.createElement('button');
      deleteButton.textContent = 'Delete';
      deleteButton.addEventListener('click', function() {
        // Confirm deletion with the user
        var confirmDelete = confirm('Are you sure you want to delete ' + item.name + '?');
        if (confirmDelete) {
          // Remove the item from the database
          db.ref('items/' + itemId).remove()
            .then(function() {
              console.log('Item deleted successfully');
            })
            .catch(function(error) {
              console.error('Error deleting item:', error);
            });
        }
      });

      itemCard.appendChild(itemName);
      itemCard.appendChild(itemCount);
      itemCard.appendChild(editButton);
      itemCard.appendChild(deleteButton);
      itemListElement.appendChild(itemCard);
    });

    // Update the total count
    totalElement.textContent = snapshot.numChildren();
  } catch (e) {
    console.error(e);
  }
});

function addItem() {
  var itemNameInput = document.getElementById('item-name');
  var itemCountInput = document.getElementById('item-count');
  var itemImageInput = document.getElementById('item-image');
  var itemDescriptionInput = document.getElementById('item-description');

  var newItem = {
    name: itemNameInput.value,
    count: parseInt(itemCountInput.value),
    image: itemImageInput.value,
    description: itemDescriptionInput.value
  };

  db.ref('items')
    .push(newItem)
    .then(function() {
      console.log('Item added successfully');
      itemNameInput.value = '';
      itemCountInput.value = '';
      itemImageInput.value = '';
      itemDescriptionInput.value = '';
    })
    .catch(function(error) {
      console.log('Error adding item:', error);
    });
}

// Call the displayItemList function to populate the item list on the index.html page
displayItemList();

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