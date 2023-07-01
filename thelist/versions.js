// Initialize Firebase
var config = {
    // Your Firebase configuration
  };
  
  firebase.initializeApp(config);
  
  // Reference to the Firebase database
  var db = firebase.database();
  
  // Get the item name from the URL hash
  var itemName = decodeURIComponent(window.location.hash.substr(1));
  
  // Reference to the versions of the item in the database
  var versionsRef = db.ref('items/' + itemName);
  
  // Function to display the versions of the item
  function displayVersions() {
    versionsRef.on('value', function(snapshot) {
      var versionsList = document.getElementById('versionsList');
      versionsList.innerHTML = '';
  
      snapshot.forEach(function(childSnapshot) {
        var version = childSnapshot.key;
        var versionData = childSnapshot.val();
  
        var versionCard = document.createElement('div');
        versionCard.classList.add('version-card');
  
        var versionName = document.createElement('h2');
        versionName.textContent = version;
  
        var versionCount = document.createElement('p');
        versionCount.textContent = 'Count: ' + versionData.count;
  
        // You can add more elements to display other properties of the version
  
        versionCard.appendChild(versionName);
        versionCard.appendChild(versionCount);
        versionsList.appendChild(versionCard);
      });
    });
  }
  
  // Call the displayVersions function to populate the versions list
  displayVersions();