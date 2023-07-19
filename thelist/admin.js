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
      var totalCount = 0; // Initialize the total count

      snapshot.forEach(function (childSnapshot) {
        var itemName = childSnapshot.key; // Retrieve the name of the item

        childSnapshot.forEach(function (versionSnapshot) {
          var versionKey = versionSnapshot.key; // Retrieve the key of the version
          var version = versionSnapshot.val(); // Retrieve the version object

          var itemCard = document.createElement('div');
          itemCard.classList.add('item-card');

          var itemNameElement = document.createElement('a');
          itemNameElement.textContent = itemName + ' (' + versionKey + ')';
          itemNameElement.href = 'versions.html#' + encodeURIComponent(itemName);

          var itemCount = document.createElement('p');
          itemCount.textContent = 'Count: ' + version.count;

          var editButton = document.createElement('button');
          editButton.textContent = 'Edit';
          editButton.addEventListener('click', function () {
            editItem(itemName, versionKey, version); // Pass the item name, version key, and version to the edit function
          });

          var deleteButton = document.createElement('button');
          deleteButton.textContent = 'Delete';
          deleteButton.addEventListener('click', function () {
            deleteItem(itemName, versionKey); // Pass the item name and version key to the delete function
          });

          itemCard.appendChild(itemNameElement);
          itemCard.appendChild(itemCount);
          itemCard.appendChild(editButton);
          itemCard.appendChild(deleteButton);
          itemListElement.appendChild(itemCard);

          totalCount += version.count; // Accumulate the total count
        });
      });

      totalElement.textContent = totalCount;
    } catch (e) {
      console.error(e);
    }
  });
}

// Add an event listener for the form submission
var newItemForm = document.getElementById('new-item-form');
newItemForm.addEventListener('submit', function (event) {
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
    .then(function () {
      console.log('New item added successfully');
      newItemForm.reset(); // Reset the form fields
    })
    .catch(function (error) {
      console.error('Error adding new item:', error);
    });
});

// Listen for changes in the items data and update the item list
db.ref('items').on('value', function (snapshot) {
  displayItemList();
});

// Load the item content based on the URL hash
window.addEventListener('DOMContentLoaded', function () {
  var itemHash = window.location.hash.substr(1);
  var itemName = decodeURIComponent(itemHash);

  db.ref('items')
    .orderByChild('name')
    .equalTo(itemName)
    .limitToFirst(1)
    .once('value')
    .then(function (snapshot) {
      if (!snapshot.exists()) {
        // Handle invalid or non-existing item names
        console.log('Item not found: ' + itemName);
      } else {
        var item = Object.values(snapshot.val())[0];
        updateItemPage(item);
      }
    })
    .catch(function (error) {
      console.log('Error getting item:', error);
    });
});

// Call the displayItemList function to populate the item list on the index.html page
db.ref('items').once('value', function (snapshot) {
  displayItemList();
});

// Function to handle editing an item version
function editItem(itemName, versionKey, version) {
  var newCount = parseInt(prompt('Enter a new count:', version.count), 10);
  var newImage = prompt('Enter a new image URL:', version.image);
  var newDescription = prompt('Enter a new description:', version.description);

  if (!isNaN(newCount) && newImage && newDescription) {
    var itemRef = db.ref('items/' + itemName + '/' + versionKey);
    itemRef.update({
      count: newCount,
      image: newImage,
      description: newDescription
    })
      .then(function () {
        console.log('Item version updated successfully');
      })
      .catch(function (error) {
        console.error('Error updating item version:', error);
      });
  }
}


// Function to handle deleting an item
function deleteItem(key, versionKey) {
  if (confirm('Are you sure you want to delete this item version?')) {
    db.ref('items/' + key + '/' + versionKey).remove();
  }
}

// Function to check the password and grant access to the admin panel
function checkPassword() {
  var password = document.getElementById('password').value;

  // Replace 'YOUR_ADMIN_PASSWORD' with your desired password
  if (password === 'YOUR_ADMIN_PASSWORD') {
    // If the password is correct, redirect to the admin panel
    window.location.href = 'admin_panel.html';
  } else {
    // If the password is incorrect, show an error message
    alert('Incorrect password. GET OUT WHORE.');
  }
}