// Display the list of items on the index.html page
function displayItemList() {
  db.collection('items').onSnapshot((snapshot) => {
    itemListElement.innerHTML = '';

    snapshot.forEach((doc) => {
      var item = doc.data();

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
    totalElement.textContent = snapshot.docs.reduce(function (acc, doc) {
      return acc + doc.data().count;
    }, 0);
  });
}

// Find an item in the itemList array by its name
function findItemByName(name) {
  for (var i = 0; i < itemList.length; i++) {
    if (itemList[i].name === name) {
      return itemList[i];
    }
  }
  return null;
}

// Update the item page with the content of the selected item
function updateItemPage(item) {
  var itemNameElement = document.getElementById('item-name');
  var itemCountElement = document.getElementById('item-count');
  var itemImageElement = document.getElementById('item-image');
  var itemDescriptionElement = document.getElementById('item-description');

  itemNameElement.textContent = item.name;
  itemCountElement.textContent = 'Count: ' + item.count.toString();
  itemImageElement.src = item.image;
  itemDescriptionElement.textContent = item.description;
}

// Load the item content based on the URL hash
function loadItemContent() {
  var itemHash = window.location.hash.substr(1);
  var itemName = decodeURIComponent(itemHash);

  db.collection('items')
    .where('name', '==', itemName)
    .get()
    .then((querySnapshot) => {
      if (querySnapshot.size === 0) {
        // Handle invalid or non-existing item names
        console.log('Item not found: ' + itemName);
      } else {
        var item = querySnapshot.docs[0].data();
        updateItemPage(item);
      }
    })
    .catch((error) => {
      console.log('Error getting item:', error);
    });
}

// Call the displayItemList function to populate the item list on the index.html page
displayItemList();

// Load the item content based on the URL hash
window.addEventListener('DOMContentLoaded', function() {
  loadItemContent();
});
