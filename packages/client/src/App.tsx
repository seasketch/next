import React from "react";
import "./App.css";
import { BrowserRouter as Router, Switch, Route, Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import SignInPage from "./SignInPage";
import { useAuth0 } from "@auth0/auth0-react";
import ProjectsPage from "./ProjectsPage";

function App() {
  const { t, i18n } = useTranslation();
  const {
    user,
    isAuthenticated,
    logout,
    loginWithRedirect,
    loginWithPopup,
    isLoading,
  } = useAuth0();
  return (
    <Router>
      {isLoading ? (
        <div></div>
      ) : (
        <div className="App">
          <Switch>
            <Route path="/signin">
              <SignInPage />
            </Route>
            <Route path="/projects">
              <ProjectsPage />
            </Route>
            <Route path="/authenticate">
              <span>authenticating...</span>
            </Route>
            <Route path="/">
              <header className="App-header">
                <p>{t("Welcome to SeaSketch")}</p>
                <a className="App-link" href="/projects">
                  {t("Projects")}
                </a>
                {!user ? (
                  <a
                    className="App-link"
                    href="/"
                    onClick={() =>
                      loginWithRedirect({
                        redirectUri: `${window.location.protocol}//${window.location.host}/authenticate?forwardTo=/projects`,
                      })
                    }
                  >
                    {t("Sign In")}
                  </a>
                ) : (
                  <a
                    className="App-link"
                    href="/"
                    onClick={() =>
                      logout({
                        localOnly: false,
                        returnTo: window.location.toString(),
                      })
                    }
                  >
                    {t("Sign Out")}
                    <br /> ({user.name})
                  </a>
                )}
              </header>
            </Route>
          </Switch>
        </div>
      )}
    </Router>
  );
}

export default App;
