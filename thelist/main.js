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
    var totalCount = 0;

    try {
      snapshot.forEach(function (childSnapshot) {
        var itemKey = childSnapshot.key; // Retrieve the key of the item
        var item = childSnapshot.val();
        var versions = item.versions || {}; // Get the versions of the item
        var itemCount = 0; // Initialize count for the item

        var itemCard = document.createElement('div');
        itemCard.classList.add('item-card');

        var itemName = document.createElement('a');
        itemName.textContent = item.name;
        itemName.href = 'versions.html#' + encodeURIComponent(itemKey); // Link to the versions page

        for (var versionKey in versions) {
          if (versions.hasOwnProperty(versionKey)) {
            itemCount += versions[versionKey].count || 0; // Add version count to item count
          }
        }

        var itemCountElement = document.createElement('p');
        itemCountElement.textContent = item.name + ' count: ' + itemCount;

        totalCount += itemCount; // Add to the total count

        itemCard.appendChild(itemName);
        itemCard.appendChild(itemCountElement);
        itemListElement.appendChild(itemCard);
      });

      totalElement.textContent = 'Total Items: ' + snapshot.numChildren();
      totalItemCountElement.textContent = 'Total Count: ' + totalCount;
    } catch (e) {
      console.error(e);
    }
  });
}

// Call the displayItemList function to populate the item list on the main page
displayItemList();