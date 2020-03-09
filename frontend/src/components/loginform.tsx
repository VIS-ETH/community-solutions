import * as React from "react";
import { css } from "glamor";
import { fetchpost } from "../fetch-utils";
import Container from "./container";
import Button from "./button";
import TextInput from "./text-input";

interface Props {
  userinfoChanged: () => void;
}

interface State {
  username: string;
  password: string;
  error: string;
}

const styles = {
  wrapper: css({
    maxWidth: "300px",
    margin: "auto",
  }),
  form: css({
    marginTop: "100px",
    "& input": {
      width: "100%",
    },
    "& button": {
      width: "100%",
    },
  }),
};

export default class LoginForm extends React.Component<Props> {
  state: State = {
    username: "",
    password: "",
    error: "",
  };

  loginUser = (ev: React.MouseEvent<HTMLElement>) => {
    ev.preventDefault();

    const data = {
      username: this.state.username,
      password: this.state.password,
      simulate_nonadmin: ev.shiftKey ? "1" : "",
    };

    fetchpost("/api/login", data)
      .then(() => {
        this.props.userinfoChanged();
      })
      .catch(err => {
        this.setState({
          error: err.toString(),
        });
      });
  };

  render() {
    return (
      <Container maxWidth="400px">
        {this.state.error && <div>{this.state.error}</div>}
        <form {...styles.form}>
          <div>
            <TextInput
              onChange={ev => this.setState({ username: ev.target.value })}
              value={this.state.username}
              type="text"
              placeholder="username"
              autoFocus={true}
              required
            />
          </div>
          <div>
            <TextInput
              onChange={ev => this.setState({ password: ev.target.value })}
              value={this.state.password}
              type="password"
              placeholder="password"
              required
            />
          </div>
          <div>
            <Button type="submit" onClick={this.loginUser}>
              Login
            </Button>
          </div>
        </form>
        {window.location.hostname === "localhost" && (
          <div>
            <p>
              <b>Possible Debug Logins</b>
            </p>
            <p>schneij : UOmtnC7{"{"}'%G</p>
            <p>fletchz : 123456abc</p>
            <p>morica : admin666</p>
          </div>
        )}
      </Container>
    );
  }
}
