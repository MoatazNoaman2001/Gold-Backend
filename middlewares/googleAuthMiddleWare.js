import passport from "passport";

export const authenticateGoogle = passport.authenticate('google', {
    scope:['profile', 'email'],
    session: false
});

export const handleGoogleCallback = passport.authenticate('google', {
    failureRedirect: '/auth/google/failure',
    session:false
})