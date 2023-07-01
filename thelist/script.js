// Create an object to hold the item data
var Item = function(name, count, image, description) {
  this.name = name;
  this.count = count;
  this.image = image;
  this.description = description;
};

// Global variable to hold the item data
var itemList = [];

// Fetch the item data from the JSON file
function fetchItemList() {
  fetch('items.json')
    .then(function(response) {
      return response.json();
    })
    .then(function(data) {
      itemList = data;
      displayItemList();
    })
    .catch(function(error) {
      console.log('Error fetching item data:', error);
    });
}

// Save the item data to the JSON file
function saveItemList() {
  fetch('https://api.github.com/repos/SnowJay2005/SnowJay2005.github.io/contents/thelist/items.json', {
    method: 'PUT',
    headers: {
      AAuthorization: 'Bearer ' + process.env.THELIST_TOKEN,
      Accept: 'application/vnd.github.v3+json',
    },
    body: JSON.stringify({
      message: 'Update item data',
      content: btoa(JSON.stringify(itemList, null, 2)),
      sha: 'SHA_OF_PREVIOUS_FILE_VERSION',
    }),
  })
    .then(function(response) {
      if (response.ok) {
        console.log('Item data saved successfully');
      } else {
        throw new Error('Failed to save item data');
      }
    })
    .catch(function(error) {
      console.log('Error saving item data:', error);
    });
}

// Update the item count
function updateItemCount(itemName, count) {
  var item = findItemByName(itemName);
  if (item) {
    item.count = count;
    saveItemList();
  }
}

// Display the list of items on the index.html page
function displayItemList() {
  itemListElement.innerHTML = '';

  for (var i = 0; i < itemList.length; i++) {
    var item = itemList[i];

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
  }
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

  var item = findItemByName(itemName);
  if (item) {
    updateItemPage(item);
  } else {
    // Handle invalid or non-existing item names
    console.log('Item not found: ' + itemName);
  }
}

// Call the fetchItemList function to populate the item list from the JSON file
fetchItemList();

// Check if the page is an item page and load the item content if necessary
if (window.location.pathname.includes('/thelist/item.html')) {
  loadItemContent();
}

// Get the count update elements
var itemCountInput = document.getElementById('item-count-input');
var updateCountBtn = document.getElementById('update-count-btn');

// Event listener for count update button click
updateCountBtn.addEventListener('click', function() {
  var count = parseInt(itemCountInput.value, 10);
  if (!isNaN(count)) {
    var itemName = decodeURIComponent(window.location.hash.substr(1));
    updateItemCount(itemName, count);
  }
});
