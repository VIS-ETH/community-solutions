import { Card, CardBody, CardFooter, Progress } from "@vseth/components";
import { Result } from "quick-score";
import React from "react";
import { useHistory } from "react-router-dom";
import { CategoryMetaData } from "../interfaces";
import { highlight } from "../utils/search-utils";
import { focusOutline } from "../utils/style";

interface Props {
  category: Result<CategoryMetaData, "displayname"[]>;
}
const CategoryCard: React.FC<Props> = ({ category }) => {
  const history = useHistory();
  const handleKeyDown = (e: React.KeyboardEvent<HTMLElement>) => {
    if (e.keyCode === 13) {
      history.push(`/category/${category.item.slug}`);
    }
  };
  return (
    <Card
      className={focusOutline}
      tabIndex={0}
      onClick={() => history.push(`/category/${category.item.slug}`)}
      onKeyDown={handleKeyDown}
    >
      <CardBody>
        <h5>
          {highlight(category.item.displayname, category.matches.displayname)}
        </h5>
        <div>
          Exams:{" "}
          {`${category.item.examcountanswered} / ${category.item.examcountpublic}`}
        </div>
        <div>
          Answers: {((category.item.answerprogress * 100) | 0).toString()} %
        </div>
      </CardBody>
      <CardFooter>
        <Progress value={category.item.answerprogress} max={1} />
      </CardFooter>
    </Card>
  );
};
export default CategoryCard;
