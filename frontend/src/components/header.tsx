import * as React from "react";
import { Link } from "react-router-dom";
import { css } from "glamor";
import Colors from "../colors";
import { fetchapi } from "../fetch-utils";
import { Menu } from "react-feather";
import { variable } from "./ThemeProvider";

interface Props {
  username?: string;
  displayName?: string;
}

interface State {
  notificationCount: number;
  menuVisibleOnMobile: boolean;
}
const titleLinkStyle = {
  borderBottom: "2px solid rgba(214, 218, 209, 0)",
  color: "#d6dad1",
  fontWeight: "400",
  ":link": {
    color: "#d6dad1",
  },
  ":visited": {
    color: "#d6dad1",
  },
};
const linkStyle = {
  borderBottom: "2px solid rgba(214, 218, 209, 0)",
  color: "#d6dad1",
  textTransform: "uppercase",
  fontWeight: "500",
  ":link": {
    color: "#d6dad1",
  },
  ":visited": {
    color: "#d6dad1",
  },
};
const styles = {
  wrapper: css({
    zIndex: "100",
    position: "relative",
    display: "flex",
    justifyContent: "space-between",
    color: "white",
    minHeight: "100px",
    overflow: "hidden",
    marginBottom: "10px",
    backgroundColor: "#1c1f21",
    "@media (max-width: 799px)": {
      display: "block",
    },
  }),
  logotitle: css({
    display: "flex",
    alignItems: "center",
    "@media (max-width: 799px)": {
      marginTop: "20px",
      marginBottom: "20px",
    },
  }),
  logo: css({
    height: "54px",
    marginLeft: "30px",
    "@media (max-width: 799px)": {
      height: "34px",
    },
  }),
  title: css({
    flexGrow: "1",
    marginLeft: "30px",
    fontSize: "1.35rem",
    fontWeight: "bold",
    "& a": titleLinkStyle,
    "@media (max-width: 799px)": {
      fontSize: "20px",
    },
  }),
  hamburger: css({
    display: "none",
    padding: "1em",
    cursor: "pointer",
    backgroundColor: "transparent",
    border: "none",
    color: "white",
    "&:hover": {
      backgroundColor: "transparent",
      border: "none",
    },
    "@media (max-width: 799px)": {
      display: "inline-block",
    },
    "& svg": {
      verticalAlign: "-0.3em",
    },
  }),
  activeMenuWrapper: css({
    "@media (max-width: 799px)": {
      display: "block",
    },
  }),
  inactiveMenuWrapper: css({
    "@media (max-width: 799px)": {
      display: "none",
    },
  }),
  menuWrapper: css({
    display: "flex",
    alignItems: "center",
  }),
  menuitem: css({
    display: "block",
    marginRight: "40px",
    fontSize: "1.05rem",
    "& a": linkStyle,
    "@media (max-width: 799px)": {
      fontSize: "20px",
      textAlign: "center",
      padding: "10px",
      marginRight: "0",
    },
  }),
};

export default class Header extends React.Component<Props, State> {
  state: State = {
    notificationCount: 0,
    menuVisibleOnMobile: false,
  };
  notificationInterval: number | undefined;

  componentDidMount() {
    this.notificationInterval = window.setInterval(
      this.checkNotificationCount,
      60000,
    );
    this.checkNotificationCount();
  }

  componentWillUnmount() {
    clearInterval(this.notificationInterval);
  }

  checkNotificationCount = () => {
    fetchapi("/api/notifications/unreadcount")
      .then(res => {
        this.setState({
          notificationCount: res.value,
        });
      })
      .catch(() => undefined);
  };

  toggleMenu = () => {
    this.setState(prevState => ({
      menuVisibleOnMobile: !prevState.menuVisibleOnMobile,
    }));
  };

  linkClicked = () => {
    this.setState({
      menuVisibleOnMobile: false,
    });
  };

  render() {
    return (
      <div {...styles.wrapper}>
        <div {...styles.logotitle}>
          <div>
            <Link to="/" onClick={this.linkClicked}>
              <img
                {...styles.logo}
                src="https://static.vis.ethz.ch/img/spirale_yellow.svg"
                alt="VIS Spiral Logo"
              />
            </Link>
          </div>
          <div {...styles.title}>
            <Link to="/">VIS Community Solutions</Link>
          </div>
          <button {...styles.hamburger} onClick={this.toggleMenu}>
            <Menu />
          </button>
        </div>
        <div
          {...styles.menuWrapper}
          {...(this.state.menuVisibleOnMobile
            ? styles.activeMenuWrapper
            : styles.inactiveMenuWrapper)}
        >
          <div {...styles.menuitem}>
            <Link to="/feedback" onClick={this.linkClicked}>
              Feedback
            </Link>
          </div>
          <div {...styles.menuitem}>
            <Link to="/scoreboard" onClick={this.linkClicked}>
              Scoreboard
            </Link>
          </div>
          <div {...styles.menuitem}>
            <Link
              to={`/user/${this.props.username}`}
              onClick={this.linkClicked}
            >
              {this.props.displayName}
              {this.state.notificationCount > 0
                ? " (" + this.state.notificationCount + ")"
                : ""}
            </Link>
          </div>
        </div>
      </div>
    );
  }
}
