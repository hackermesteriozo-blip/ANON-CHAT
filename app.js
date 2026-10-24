
onAuthStateChanged(auth, (user) => {
  if (user && user.isAnonymous) {
    const savedName = sessionStorage.getItem("anonChatName");

    if (savedName) {
      if (user.displayName !== savedName) {
        updateProfile(user, { displayName: savedName })
          .then(() => showChat(user))
          .catch(() => showChat(user));
      } else {
        showChat(user);
      }
    } else {
      showLogin();
    }
  } else {
    showLogin();
  }
});
