import { Alert, Button, List } from "@mantine/core";
import React, { useState } from "react";
import { Link } from "react-router-dom";
import { useUser } from "../auth";
import GlobalConsts from "../globalconsts";
import Grid from "./grid";
import { lightFormat, parseISO } from "date-fns";
import {
  useGetPayments,
  useRefundPayment,
  useRemovePayment,
  usePay,
} from "../api/hooks/payments";

interface UserPaymentsProps {
  username: string;
}
const UserPayments: React.FC<UserPaymentsProps> = ({ username }) => {
  const user = useUser()!;
  const isAdmin = user.isAdmin;
  const {
    error: paymentsError,
    data: payments,
    refetch: reloadPayments,
  } = useGetPayments(username, {
    query: {
      select: ({ value: data }) => data,
    },
  });
  const { error: refundError, mutate: refund } = useRefundPayment({
    mutation: {
      onSuccess: async () => reloadPayments(),
    },
  });
  const { error: removeError, mutate: remove } = useRemovePayment({
    mutation: {
      onSuccess: async () => reloadPayments(),
    },
  });
  const { error: addError, mutate: add } = usePay({
    mutation: {
      onSuccess: async () => reloadPayments(),
    },
  });

  const error = paymentsError ?? refundError ?? removeError ?? addError;
  const [openPayment, setOpenPayment] = useState<number | null>(null);
  return (
    <div>
      {error && <Alert color="red">{error as unknown as string}</Alert>}
      <h3>Paid Oral Exams</h3>
      {payments && (payments.length > 0 || isAdmin) && (
        <>
          {payments
            .filter(payment => payment.active)
            .map(payment => (
              <Alert mb="xs" key={payment.oid}>
                You have paid for all oral exams until{" "}
                {lightFormat(
                  parseISO(payment.valid_until),
                  GlobalConsts.dateFNSFormatStringDate,
                )}
                .
              </Alert>
            ))}
          <Grid>
            {payments.map(payment =>
              openPayment === payment.oid ? (
                <List key={payment.oid} onClick={() => setOpenPayment(null)}>
                  <div>
                    Payment Time:{" "}
                    {lightFormat(
                      parseISO(payment.payment_time),
                      GlobalConsts.dateFNSFormatString,
                    )}
                  </div>
                  <div>
                    Valid Until:{" "}
                    {lightFormat(
                      parseISO(payment.valid_until),
                      GlobalConsts.dateFNSFormatStringDate,
                    )}
                  </div>
                  {payment.refund_time && (
                    <div>
                      Refund Time:{" "}
                      {lightFormat(
                        parseISO(payment.refund_time),
                        GlobalConsts.dateFNSFormatString,
                      )}
                    </div>
                  )}
                  {payment.uploaded_filename && (
                    <div>
                      <Link
                        color="dark"
                        to={`/exams/${payment.uploaded_filename}`}
                      >
                        Uploaded Transcript
                      </Link>
                    </div>
                  )}
                  {isAdmin && (
                    <div>
                      {!payment.refund_time && (
                        <Button
                          onClick={() => refund({ oid: payment.oid })}
                          mr="xs"
                        >
                          Mark Refunded
                        </Button>
                      )}
                      <Button onClick={() => remove({ oid: payment.oid })}>
                        Remove Payment
                      </Button>
                    </div>
                  )}
                </List>
              ) : (
                <List
                  key={payment.oid}
                  onClick={() => setOpenPayment(payment.oid)}
                >
                  <div>
                    Payment Time:{" "}
                    {lightFormat(
                      parseISO(payment.payment_time),
                      GlobalConsts.dateFNSFormatString,
                    )}
                  </div>
                </List>
              ),
            )}
          </Grid>
        </>
      )}
      {isAdmin && !payments?.find(payment => payment.active) && (
        <Button onClick={() => add({ data: { username } })}>Add Payment</Button>
      )}
    </div>
  );
};
export default UserPayments;
