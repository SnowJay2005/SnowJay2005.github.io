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

// Function to display the versions
function displayVersions() {
  // Retrieve the item name from the URL hash
  var itemName = decodeURIComponent(location.hash.substr(1));

  // Set the item name in the header
  document.getElementById('item-name').textContent = itemName;

  // Get a reference to the versions of the item
  var versionsRef = db.ref('items/' + itemName);

  // Attach a listener to listen for changes in the versions
  versionsRef.on('value', function(snapshot) {
    var versionsListElement = document.getElementById('versions-list');
    versionsListElement.innerHTML = '';

    snapshot.forEach(function(childSnapshot) {
      var version = childSnapshot.key;
      var versionData = childSnapshot.val();

      var versionCard = document.createElement('div');
      versionCard.classList.add('item-card');

      var versionName = document.createElement('h2');
      versionName.textContent = version;

      var versionCount = document.createElement('p');
      versionCount.textContent = 'Count: ' + versionData.count;

      var versionImage = document.createElement('img');
      versionImage.src = versionData.image;
      versionImage.alt = version + ' Image';

      var versionDescription = document.createElement('p');
      versionDescription.textContent = 'Description: ' + versionData.description.replace(/\n/g, '<br>');

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