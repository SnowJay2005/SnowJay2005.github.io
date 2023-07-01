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
  db.ref('items').on('value', function(snapshot) {
    itemListElement.innerHTML = '';

    try {
      snapshot.forEach(function(childSnapshot) {
        var itemName = childSnapshot.key; // Retrieve the item name
        var itemVersions = childSnapshot.val();

        var totalItemCount = 0;

        // Iterate over each version of the item
        for (var versionKey in itemVersions) {
          if (itemVersions.hasOwnProperty(versionKey)) {
            var item = itemVersions[versionKey];

            var itemCard = document.createElement('div');
            itemCard.classList.add('item-card');

            var itemNameElement = document.createElement('p');
            itemNameElement.textContent = itemName;

            var itemVersionElement = document.createElement('p');
            itemVersionElement.textContent = versionKey;

            var itemCountElement = document.createElement('p');
            itemCountElement.textContent = 'Count: ' + item.count;

            itemCard.appendChild(itemNameElement);
            itemCard.appendChild(itemVersionElement);
            itemCard.appendChild(itemCountElement);
            itemListElement.appendChild(itemCard);

            totalItemCount += item.count;
          }
        }

        // Display the total count for the item
        var totalItemElement = document.createElement('p');
        totalItemElement.textContent = itemName + ' Total Count: ' + totalItemCount;
        itemListElement.appendChild(totalItemElement);
      });
    } catch (e) {
      console.error(e);
    }
  });
}

// Call the displayItemList function to populate the item list on the main page
displayItemList();