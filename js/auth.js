const Auth = (function () {
  let currentUser = null;
  let currentRole = 'readonly';
  let onChange = function () {};

  async function loadProfile(user) {
    if (!user) return null;

    const result = await SupabaseClient
      .from('profiles')
      .select('id, email, display_name, role')
      .eq('id', user.id)
      .maybeSingle();

    if (result.error) {
      console.error('Error cargando perfil', result.error);
      return null;
    }
    return result.data;
  }

  async function updateSession(session) {
    currentUser = session ? session.user : null;
    const profile = await loadProfile(currentUser);
    currentRole = profile ? profile.role : 'readonly';
    onChange({ user: currentUser, profile: profile, role: currentRole });
  }

  async function init(changeHandler) {
    onChange = changeHandler || function () {};
    const sessionResult = await SupabaseClient.auth.getSession();
    await updateSession(sessionResult.data.session);

    SupabaseClient.auth.onAuthStateChange(function (_event, session) {
      updateSession(session);
    });
  }

  function signIn() {
    return SupabaseClient.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin + window.location.pathname }
    });
  }

  function signOut() {
    return SupabaseClient.auth.signOut();
  }

  return {
    init: init,
    signIn: signIn,
    signOut: signOut,
    getUser: function () { return currentUser; },
    getRole: function () { return currentRole; },
    canEdit: function () { return currentRole === 'editor' || currentRole === 'admin'; },
    isAdmin: function () { return currentRole === 'admin'; }
  };
})();