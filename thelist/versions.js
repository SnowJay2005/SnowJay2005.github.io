// Get the item name from the URL hash
var itemName = decodeURIComponent(window.location.hash.substr(1));

// Display the item name
var itemNameElement = document.getElementById('item-name');
itemNameElement.textContent = itemName;

// Function to display the versions of an item
function displayVersions() {
  db.ref('items/' + itemName).on('value', function (snapshot) {
    versionsListElement.innerHTML = '';

    try {
      snapshot.forEach(function (childSnapshot) {
        var versionKey = childSnapshot.key; // Retrieve the key of the version
        var version = childSnapshot.val();

        var versionCard = document.createElement('div');
        versionCard.classList.add('version-card');

        var versionCount = document.createElement('p');
        versionCount.textContent = 'Count: ' + version.count;

        var versionImage = document.createElement('img');
        versionImage.src = version.image;
        versionImage.alt = 'Version Image';

        var versionDescription = document.createElement('p');
        versionDescription.textContent = 'Description: ' + version.description;

        versionCard.appendChild(versionCount);
        versionCard.appendChild(versionImage);
        versionCard.appendChild(versionDescription);
        versionsListElement.appendChild(versionCard);
      });
    } catch (e) {
      console.error(e);
    }
  });
}

// Call the displayVersions function to show the versions of the item
displayVersions();