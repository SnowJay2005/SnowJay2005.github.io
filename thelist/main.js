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

        // Iterate over each version of the item and calculate the total count
        for (var versionKey in itemVersions) {
          if (itemVersions.hasOwnProperty(versionKey)) {
            var item = itemVersions[versionKey];
            totalItemCount += item.count;
          }
        }

        // Create a container div for the item
        var itemContainer = document.createElement('div');
        itemContainer.classList.add('item-card');

        // Display the item name
        var itemNameElement = document.createElement('a');
        itemNameElement.classList.add('item-name');
        itemNameElement.textContent = itemName;
        itemNameElement.href = 'versions.html#' + encodeURIComponent(itemName);
        itemContainer.appendChild(itemNameElement);

        // Display the total count for the item
        var totalItemElement = document.createElement('p');
        totalItemElement.classList.add('item-count');
        totalItemElement.textContent = 'Total Count: ' + totalItemCount;
        itemContainer.appendChild(totalItemElement);

        itemListElement.appendChild(itemContainer);
      });
    } catch (e) {
      console.error(e);
    }
  });
}

// Update the total count
var totalElement = document.getElementById('total');
var totalCount = 0;

itemList.forEach(function (item) {
  totalCount += item.count;
});

totalElement.textContent = 'Total Count: ' + totalCount;

// Call the displayItemList function to populate the item list on the main page
displayItemList();