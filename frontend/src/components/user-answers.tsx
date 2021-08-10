import { css } from "@emotion/css";
import { Alert, CardColumns, Spinner } from "@vseth/components";
import React from "react";
import { useUserAnswers } from "../api/hooks";
import AnswerComponent from "./answer";
interface UserAnswersProps {
  username: string;
}
const UserAnswers: React.FC<UserAnswersProps> = ({ username }) => {
  const [error, loading, answers, reload] = useUserAnswers(username);
  return (
    <>
      <h2>Answers</h2>
      {error && <Alert color="danger">{error.message}</Alert>}
      {loading && <Spinner />}
      <div className="py-2">
        {answers &&
          answers.map((answer) => (
            <div className="px-2" key={answer.oid}>
              <AnswerComponent
                hasId={false}
                answer={answer}
                isLegacyAnswer={answer.isLegacyAnswer}
                onSectionChanged={reload}
              />
            </div>
          ))}
      </div>
    </>
  );
};
export default UserAnswers;
