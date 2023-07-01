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
      var totalItemCount = 0;

      snapshot.forEach(function (childSnapshot) {
        var item = childSnapshot.val();
        var itemKey = childSnapshot.key; // Retrieve the key of the item

        var itemCard = document.createElement('div');
        itemCard.classList.add('item-card');

        var itemName = document.createElement('a');
        itemName.textContent = item.name;
        itemName.href = 'item.html#' + encodeURIComponent(itemKey);

        var itemCount = document.createElement('p');
        var count = 0;
        for (var version in item) {
          if (version !== 'name') {
            count += item[version].count;
          }
        }
        itemCount.textContent = 'Count: ' + count;

        totalItemCount += count;

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
        itemCard.appendChild(itemCount);
        itemCard.appendChild(editButton);
        itemCard.appendChild(deleteButton);
        itemListElement.appendChild(itemCard);
      });

      totalItemCountElement.textContent = 'Total Count: ' + totalItemCount;
    } catch (e) {
      console.error(e);
    }
  });
}

// Call the displayItemList function to populate the item list on the main page
displayItemList();