// Load the item list from the GitHub repository
function loadItemList() {
  fetch('https://api.github.com/repos/SnowJay2005/SnowJay2005.github.io/contents/thelist/items.json', {
    headers: {
      Authorization: 'Bearer ' + process.env.THELIST_TOKEN,
      Accept: 'application/vnd.github.v3+json',
    },
  })
    .then(function(response) {
      if (response.ok) {
        return response.json();
      } else {
        throw new Error('Failed to load item data');
      }
    })
    .then(function(data) {
      var content = atob(data.content);
      itemList = JSON.parse(content);
      displayItemList();
    })
    .catch(function(error) {
      console.log('Error loading item data:', error);
    });
}

// Save the item list to the GitHub repository
function saveItemList() {
  fetch('https://api.github.com/repos/SnowJay2005/SnowJay2005.github.io/contents/thelist/items.json', {
    method: 'PUT',
    headers: {
      Authorization: 'Bearer ' + process.env.THELIST_TOKEN,
      Accept: 'application/vnd.github.v3+json',
    },
    body: JSON.stringify({
      message: 'Update item data',
      content: btoa(JSON.stringify(itemList, null, 2)),
      sha: itemDataSha,
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

// Event handler for item count update
function onItemCountUpdate(event) {
  var target = event.target;
  var itemName = target.getAttribute('data-item-name');
  var item = findItemByName(itemName);

  if (item) {
    item.count = parseInt(target.value);
    saveItemList(); // Save the item list after updating the count
  }
}

// Attach event listeners to item count input fields
function attachItemCountListeners() {
  var itemCountInputs = document.querySelectorAll('.item-count-input');

  itemCountInputs.forEach(function(input) {
    input.addEventListener('input', onItemCountUpdate);
  });
}

// Call the displayItemList function to populate the item list on the index.html page
displayItemList();

// Load the item list from the GitHub repository
loadItemList();

// Attach event listeners to item count input fields
attachItemCountListeners();
