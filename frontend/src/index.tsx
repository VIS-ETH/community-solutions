import ReactDOM from "react-dom/client";
import { BrowserRouter, Route } from "react-router-dom";
import { QueryParamProvider } from "use-query-params";
import App from "./app";

const x = ReactDOM.createRoot(
  document.getElementById("root") as HTMLElement,
);
x.render(<BrowserRouter>
    <App />
  </BrowserRouter>,
  )