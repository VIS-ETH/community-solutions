import * as React from "react";
import { css } from "glamor";
import { Card } from "./card";

const tableStyle = css({
  backgroundColor: "transparent",
  width: "100%",
});
interface TableProps {}
export const Table: React.FC<TableProps> = ({ children }) => {
  return (
    <Card>
      <table {...tableStyle}>{children}</table>
    </Card>
  );
};

const headerRowStyle = css({
  backgroundColor: "transparent",
});
interface TableHeaderProps {}
export const TableHeader: React.FC<TableHeaderProps> = ({ children }) => {
  return (
    <thead>
      <tr {...headerRowStyle}>{children}</tr>
    </thead>
  );
};
const headerCellStyle = css({
  backgroundColor: "transparent",
  padding: "1rem 0.8rem",
});
interface TableHeaderCellProps {}
export const TableHeaderCell: React.FC<TableHeaderCellProps> = ({
  children,
}) => {
  return <th {...headerCellStyle}>{children}</th>;
};

interface TableBodyProps {}
export const TableBody: React.FC<TableBodyProps> = ({ children }) => {
  return <tbody>{children}</tbody>;
};

interface TableRowProps {}
export const TableRow: React.FC<TableRowProps> = ({ children }) => {
  return <tr>{children}</tr>;
};

const cellStyle = css({
  padding: "1rem 0.8rem",
});
interface TableCellProps {}
export const TableCell: React.FC<TableCellProps> = ({ children }) => {
  return <td {...cellStyle}>{children}</td>;
};
