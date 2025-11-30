rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    // Deny all reads and writes by default
    match /{allPaths=**} {
      allow read, write: if false;
    }

    // Allow authenticated users to read soundboard files
    match /Soundboard/{soundboardPath=**} {
      allow read: if request.auth != null;
    }
  }
}
