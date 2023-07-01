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
    var itemList = [];

    try {
      snapshot.forEach(function(childSnapshot) {
        var item = childSnapshot.val();
        itemList.push(item);

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

      totalElement.textContent = itemList.length;
    } catch (e) {
      console.error(e);
    }
  });
}

// Call the displayItemList function to populate the item list on the main page
displayItemList();