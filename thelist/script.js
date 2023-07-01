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

function displayItemList() {
  db.ref('items').on('value', function(snapshot) {
    itemListElement.innerHTML = '';

    try {
      snapshot.forEach(function(childSnapshot) {
        var item = childSnapshot.val();

        var itemCard = document.createElement('div');
        itemCard.classList.add('item-card');

        var itemName = document.createElement('a');
        itemName.textContent = item.name;
        itemName.href = 'item.html#' + encodeURIComponent(item.name);

        var itemCount = document.createElement('p');
        itemCount.textContent = 'Count: ' + item.count;

        itemCard.appendChild(itemName);
        itemCard.appendChild(itemCount);
        itemListElement.appendChild(itemCard);
      });

      // Update the total count
      totalElement.textContent = snapshot.numChildren();
    } catch (e) {
      console.error(e);
    }
  });
}

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
  loadItemContent();
});