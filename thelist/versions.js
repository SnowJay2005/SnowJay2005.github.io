// Firebase configuration
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

// Get a reference to the Firebase Realtime Database
var db = firebase.database();

// Variable to store censorship status
var censorshipEnabled;

// Check if censorship preference is set in local storage on page load
var censorshipLocalStorage = localStorage.getItem('censorshipEnabled');
if (censorshipLocalStorage === null) {
  // If censorship preference is not set in local storage, set it to 'true' by default
  localStorage.setItem('censorshipEnabled', 'true');
  censorshipEnabled = true;
} else {
  censorshipEnabled = censorshipLocalStorage === 'true';
}

// Function to toggle image censorship
function toggleImageCensorship(censorshipEnabled) {
  var images = document.querySelectorAll('img');

  if (images.length > 0) {
    for (var i = 0; i < images.length; i++) {
      var image = images[i];
      var censorImageURL = 'https://media.discordapp.net/attachments/784434827163598898/1138379532198486077/censored_images.png?width=1440&height=288'; // Replace with the URL of your censor image

      if (censorshipEnabled) {
        // If censorship is enabled, show the censor image
        image.src = censorImageURL; // Replace the 'src' attribute with the censor image URL
        image.classList.add('censored-image'); // Add the 'censored-image' class
      } else {
        // If censorship is disabled, show the original image
        image.src = image.dataset.originalSrc || ''; // Use the original image URL stored in 'data-original-src', if available
        image.classList.remove('censored-image'); // Remove the 'censored-image' class
      }
    }
  }
}

// Function to display the versions
function displayVersions() {
  // Retrieve the item name from the URL hash
  var itemName = decodeURIComponent(location.hash.substr(1));

  // Set the item name in the header
  document.getElementById('item-name').textContent = itemName;

  // Get a reference to the versions of the item
  var versionsRef = db.ref('items/' + itemName);

  // Attach a listener to listen for changes in the versions
  versionsRef.on('value', function (snapshot) {
    var versionsListElement = document.getElementById('versions-list');
    versionsListElement.innerHTML = '';

    snapshot.forEach(function (childSnapshot) {
      var version = childSnapshot.key;
      var versionData = childSnapshot.val();

      var versionCard = document.createElement('div');
      versionCard.classList.add('item-card');

      var versionName = document.createElement('h2');
      versionName.textContent = version;

      var versionCount = document.createElement('p');
      versionCount.textContent = 'Count: ' + versionData.count;

      var versionImage = document.createElement('img');
      versionImage.src = versionData.image.replace('no', 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/89/HD_transparent_picture.png/320px-HD_transparent_picture.png');
      versionImage.alt = version + ' Image';

      var versionDescription = document.createElement('p');
      versionDescription.innerHTML = versionData.description.replace(/\n/g, '<br>');

    // Check for images in the description
    var descriptionImages = versionDescription.getElementsByTagName('img');
    if (descriptionImages.length > 0) {
      for (var j = 0; j < descriptionImages.length; j++) {
        var descriptionImage = descriptionImages[j];

        // Check the censorship preference for the description image
        var censorshipEnabled = localStorage.getItem('censorshipEnabled');
        if (censorshipEnabled === 'true') {
          descriptionImage.dataset.originalSrc = descriptionImage.src;
          descriptionImage.classList.add('censored-image');
          descriptionImage.src = 'https://media.discordapp.net/attachments/784434827163598898/1138379532198486077/censored_images.png?width=1440&height=288'; // Replace with the URL of your censor image
        } else {
          descriptionImage.src = descriptionImage.dataset.originalSrc; // Show the original image
        }
      }
    }

    // Check the censorship preference for the normal image
    var censorshipEnabled = localStorage.getItem('censorshipEnabled');
    if (censorshipEnabled === 'true') {
      versionImage.dataset.originalSrc = versionImage.src;
      versionImage.classList.add('censored-image');
      versionImage.src = 'https://media.discordapp.net/attachments/784434827163598898/1138379532198486077/censored_images.png?width=1440&height=288'; // Replace with the URL of your censor image
    } else {
      versionImage.src = versionData.image; // Show the original image
    }

      versionCard.appendChild(versionName);
      versionCard.appendChild(versionCount);
      versionCard.appendChild(versionDescription);
      versionCard.appendChild(versionImage);
      versionsListElement.appendChild(versionCard);
    });
  });
}

// Call the displayVersions function when the page loads
window.onload = displayVersions;

// Add an event listener to the toggle button
var toggleButton = document.getElementById('toggleCensorshipButton');
toggleButton.addEventListener('click', function () {
  // Toggle the image censorship
  censorshipEnabled = !censorshipEnabled;
  var images = document.querySelectorAll('img');

  if (images.length > 0) {
    for (var i = 0; i < images.length; i++) {
      var image = images[i];
      toggleImageCensorship(censorshipEnabled, image);
    }
  }

  // Update the local storage value to match the current censorship status
  localStorage.setItem('censorshipEnabled', censorshipEnabled.toString());
});