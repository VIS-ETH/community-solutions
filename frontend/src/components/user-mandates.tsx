import {
  parseISO,
  isBefore,
  addWeeks,
  lightFormat,
  differenceInCalendarDays,
  isAfter,
} from "date-fns";
import { ActionIcon, Alert, Anchor, Button, Divider, List, ListItem, Modal } from "@mantine/core";
import { useCreateMandate, useListMandates } from "../api/hooks/mandates";
import { useUser } from "../auth";
import { MandateSchema } from "../api/model";
import { useRequest } from "ahooks";
import { loadCategories } from "../api/hooks";
import { useDisclosure } from "@mantine/hooks";
import { IconAlertCircle, IconInfoCircle } from "@tabler/icons-react";
import { Link } from "react-router-dom";
import GlobalConsts from "../globalconsts";

interface UserMandatesProps {
  username: string;
}

const mandateIsOverdue = (mandate: MandateSchema): boolean => {
  return (
    (mandate.fulfilled_at == null && isBefore(parseISO(mandate.due_date), new Date())) ||
    (mandate.fulfilled_at != null &&
      !!mandate.rejected &&
      isBefore(addWeeks(parseISO(mandate.checked_at!), 2), new Date()))
  );
};

const UserMandatesProps: React.FC<UserMandatesProps> = (userProps) => {
  const user = useUser()!;
  const isAdmin = user.isAdmin;
  const {
    error: mandatesError,
    data: mandates,
    refetch: reloadMandates,
  } = useListMandates({
    username: userProps.username,
  });
  const { error: addError, mutate: add } = useCreateMandate({
    mutation: {
      onSuccess: async () => reloadMandates(),
    },
  });
  const {
    error: categoriesError,
    data: categories,
    refresh: reloadCategories,
  } = useRequest(loadCategories);
  const error = mandatesError;
  const [addMandateModalIsOpen, { open: openAddMandateModal, close: closeAddMandateModal }] =
    useDisclosure();

  const openOverdueMandates =
    mandates && mandates.value.filter((mandate) => mandateIsOverdue(mandate));
  const rejectedGraceMandates =
    mandates &&
    mandates.value.filter((mandate) => !!mandate.rejected && !mandateIsOverdue(mandate));
  const openOngoingMandates =
    mandates &&
    mandates.value.filter(
      (mandate) => mandate.fulfilled_at == null && !mandate.rejected && !mandateIsOverdue(mandate),
    );
  const archivedMandates =
    mandates &&
    mandates.value.filter((mandate) => mandate.rejected === false && mandate.fulfilled_at != null);

  if (!isAdmin && userProps.username !== user.username) {
    throw new Error("You are not authorized to view this user's mandates.");
  }

  const renderMandates = (mandates: MandateSchema[]) => {
    return (
      <List>
        {mandates.map((mandate) => {
          const rejectionGracePeriodEnd = mandate.checked_at
            ? addWeeks(parseISO(mandate.checked_at), 2)
            : null;
          return (
            <ListItem key={mandate.id}>
              Mandate on category{" "}
              <Anchor component={Link} to={`category/${mandate.category}`}>
                {mandate.category_display_name}
              </Anchor>
              : signed up for on {lightFormat(mandate.created_at, GlobalConsts.dateFNSFormatString)}
              , due on {lightFormat(mandate.due_date, GlobalConsts.dateFNSFormatStringDate)}
              <br />
              {mandate.fulfilled_at == null &&
                (isAfter(new Date(), parseISO(mandate.due_date)) ? (
                  <>
                    Mandate not fulfilled and deadline exceeded by over{" "}
                    {differenceInCalendarDays(new Date(), parseISO(mandate.due_date))} days!
                  </>
                ) : (
                  <>
                    {differenceInCalendarDays(parseISO(mandate.due_date), new Date())} days left to
                    fulfill.
                  </>
                ))}
              {mandate.checked_at != null &&
                !!mandate.rejected &&
                (isAfter(new Date(), rejectionGracePeriodEnd!) ? (
                  <>The mandate was last rejected on</>
                ) : (
                  <>
                    The mandate was last rejected on{" "}
                    {lightFormat(mandate.checked_at, GlobalConsts.dateFNSFormatString)}, after being
                    fulfilled on the{" "}
                    {lightFormat(mandate.fulfilled_at!, GlobalConsts.dateFNSFormatString)}. It needs
                    to be amended until{" "}
                    {lightFormat(rejectionGracePeriodEnd!, GlobalConsts.dateFNSFormatString)}.<br />
                  </>
                ))}
            </ListItem>
          );
        })}
      </List>
    );
  };

  return (
    <div>
      {error && <Alert color="red">{error as unknown as string}</Alert>}

      <h3>Mandates</h3>

      <Button mr="xs" onClick={openAddMandateModal}>
        Add mandate
      </Button>

      <Modal
        opened={addMandateModalIsOpen}
        onClose={closeAddMandateModal}
        title={<h3>Add mandate for category</h3>}
      >
        Select a category to add a mandate. An added mandate will require you to{" "}
        <strong>actively contribute</strong> in order for Community Solutions as a whole (all
        solutions + exams and other documents) to remain accessible.
        <br />
        In particular, failure to fulfill a mandate will result in your <strong>
          account
        </strong>{" "}
        being <strong>blocked</strong> and you will not be able to access any solutions or exams
        until the mandate is fulfilled.
        <Divider my="md" />
        Select the category:
        <List>
          {categories &&
            categories.map((cat) => {
              return (
                <ListItem>
                  <Button
                    onClick={() => {
                      add({
                        data: {
                          username: userProps.username,
                          category: cat.slug,
                        },
                      });
                      closeAddMandateModal();
                    }}
                    variant="subtle"
                    key={cat.slug}
                  >
                    {cat.displayname}
                  </Button>
                </ListItem>
              );
            })}
        </List>
      </Modal>

      {openOverdueMandates && openOverdueMandates.length > 0 && (
        <div>
          <h4>Open &amp; Overdue</h4>
          <Alert color="red" variant="filled" icon={<IconAlertCircle size={16} />}>
            <strong>Immediate attention required:</strong>
            These mandates are <strong>blocking the user's account</strong> and preventing any
            access to Community Solutions.
          </Alert>
        </div>
      )}

      {rejectedGraceMandates && rejectedGraceMandates.length > 0 && (
        <div>
          <h4>Rejected &amp; Grace period</h4>
          <Alert color="orange" variant="light" icon={<IconInfoCircle size={16} />}>
            These mandates have been rejected and are in a grace period. The user must fulfill these
            mandates to avoid <strong>account blockage</strong>.
          </Alert>
        </div>
      )}

      {openOngoingMandates && openOngoingMandates.length > 0 && (
        <div>
          <h4>Open &amp; ongoing</h4>
          <Alert color="green" variant="light" icon={<IconInfoCircle size={16} />}>
            These mandates are currently open and ongoing. During this period, the user has access
            to Community Solutions including the mandated categories and is expected to fulfill the
            mandate before its due date.
          </Alert>

          {renderMandates(openOngoingMandates)}
        </div>
      )}

      {archivedMandates && archivedMandates.length > 0 && (
        <div>
          <h4>Archived</h4>
          <Alert color="green" variant="outline" icon={<IconInfoCircle size={16} />}>
            The following mandates have been fulfilled, checked, and accepted. These mandates are
            archived and do not require any further action.
          </Alert>
          <List>
            {archivedMandates.map((mandate) => (
              <ListItem key={mandate.id}>
                Mandate on category {mandate.category} - Fulfilled on {mandate.fulfilled_at},
                checked and accepted on {mandate.checked_at}
              </ListItem>
            ))}
          </List>
        </div>
      )}
    </div>
  );
};

export default UserMandatesProps;
import {
  parseISO,
  isBefore,
  addWeeks,
  lightFormat,
  differenceInCalendarDays,
  isAfter,
} from "date-fns";
import { ActionIcon, Alert, Anchor, Button, Divider, List, ListItem, Modal } from "@mantine/core";
import { useCreateMandate, useListMandates } from "../api/hooks/mandates";
import { useUser } from "../auth";
import { MandateSchema } from "../api/model";
import { useRequest } from "ahooks";
import { loadCategories } from "../api/hooks";
import { useDisclosure } from "@mantine/hooks";
import { IconAlertCircle, IconInfoCircle } from "@tabler/icons-react";
import { Link } from "react-router-dom";
import GlobalConsts from "../globalconsts";

enum MandateStatusType {
  OPEN_ONGOING,
  OPEN_OVERDUE,
  REJECTED_GRACE,
  REJECTED_OVERDUE,
  ARCHIVED,
}

interface UserMandatesProps {
  username: string;
}

const getMandateStatusType = (mandate: MandateSchema): MandateStatusType => {
  if (["accepted", "excused"].includes(mandate.checked_state ?? ""))
    return MandateStatusType.ARCHIVED;

  if (!isAfter(new Date(), parseISO(mandate.due_date))) return MandateStatusType.OPEN_ONGOING;

  if (
    mandate.checked_state === "rejected" &&
    mandate.grace_until &&
    !isAfter(new Date(), parseISO(mandate.grace_until))
  )
    return MandateStatusType.REJECTED_GRACE;

  if (mandate.checked_state === "rejected") return MandateStatusType.REJECTED_OVERDUE;

  return MandateStatusType.OPEN_OVERDUE;
};

const UserMandatesProps: React.FC<UserMandatesProps> = (userProps) => {
  const user = useUser()!;
  const isAdmin = user.isAdmin;
  const {
    error: mandatesError,
    data: mandates,
    refetch: reloadMandates,
  } = useListMandates({
    username: userProps.username,
  });
  const { error: addError, mutate: add } = useCreateMandate({
    mutation: {
      onSuccess: async () => reloadMandates(),
    },
  });
  const {
    error: categoriesError,
    data: categories,
    refresh: reloadCategories,
  } = useRequest(loadCategories);
  const error = mandatesError;
  const [addMandateModalIsOpen, { open: openAddMandateModal, close: closeAddMandateModal }] =
    useDisclosure();

  if (!isAdmin && userProps.username !== user.username) {
    throw new Error("You are not authorized to view this user's mandates.");
  }

  const groupedMandates = Object.groupBy(mandates?.value ?? [], (mandate) =>
    getMandateStatusType(mandate),
  );

  const renderMandates = (statusType: MandateStatusType, mandates: MandateSchema[]) => {
    return (
      <List>
        {mandates.map((mandate) => {
          return (
            <ListItem key={mandate.id}>
              Mandate on category{" "}
              <Anchor component={Link} to={`category/${mandate.category}`}>
                {mandate.category_display_name}
              </Anchor>
              : signed up for on {lightFormat(mandate.created_at, GlobalConsts.dateFNSFormatString)}
              , due on {lightFormat(mandate.due_date, GlobalConsts.dateFNSFormatStringDate)}
              <br />
              {mandate.fulfilled_at == null &&
                (isAfter(new Date(), parseISO(mandate.due_date)) ? (
                  <>
                    Mandate not fulfilled and deadline exceeded by over{" "}
                    {differenceInCalendarDays(new Date(), parseISO(mandate.due_date))} days!
                  </>
                ) : (
                  <>
                    {differenceInCalendarDays(parseISO(mandate.due_date), new Date())} days left to
                    fulfill.
                  </>
                ))}
              {statusType === MandateStatusType.REJECTED_OVERDUE ? (
                <>The mandate was last rejected on</>
              ) : (
                <>
                  The mandate was last rejected on{" "}
                  {lightFormat(mandate.checked_at!, GlobalConsts.dateFNSFormatString)}, after being
                  fulfilled on the{" "}
                  {lightFormat(mandate.fulfilled_at!, GlobalConsts.dateFNSFormatString)}. It needs
                  to be amended until{" "}
                  {lightFormat(mandate.grace_until!, GlobalConsts.dateFNSFormatString)}.<br />
                </>
              )}
            </ListItem>
          );
        })}
      </List>
    );
  };

  return (
    <div>
      {error && <Alert color="red">{error as unknown as string}</Alert>}

      <h3>Mandates</h3>

      <Button mr="xs" onClick={openAddMandateModal}>
        Add mandate
      </Button>

      <Modal
        opened={addMandateModalIsOpen}
        onClose={closeAddMandateModal}
        title={<h3>Add mandate for category</h3>}
      >
        Select a category to add a mandate. An added mandate will require you to{" "}
        <strong>actively contribute</strong> in order for Community Solutions as a whole (all
        solutions + exams and other documents) to remain accessible.
        <br />
        In particular, failure to fulfill a mandate will result in your <strong>
          account
        </strong>{" "}
        being <strong>blocked</strong> and you will not be able to access any solutions or exams
        until the mandate is fulfilled.
        <Divider my="md" />
        Select the category:
        <List>
          {categories &&
            categories.map((cat) => {
              return (
                <ListItem>
                  <Button
                    onClick={() => {
                      add({
                        data: {
                          username: userProps.username,
                          category: cat.slug,
                        },
                      });
                      closeAddMandateModal();
                    }}
                    variant="subtle"
                    key={cat.slug}
                  >
                    {cat.displayname}
                  </Button>
                </ListItem>
              );
            })}
        </List>
      </Modal>

      {MandateStatusType.OPEN_ONGOING in groupedMandates && (
        <div>
          <h4>Open &amp; ongoing</h4>
          <Alert color="green" variant="light" icon={<IconInfoCircle size={16} />}>
            These mandates are currently open and ongoing. During this period, the user has access
            to Community Solutions including the mandated categories and is expected to fulfill the
            mandate before its due date.
          </Alert>

          {renderMandates(
            MandateStatusType.OPEN_ONGOING,
            groupedMandates[MandateStatusType.OPEN_ONGOING]!,
          )}
        </div>
      )}

      {MandateStatusType.REJECTED_GRACE in groupedMandates && (
        <div>
          <h4>Rejected &amp; Grace period</h4>
          <Alert color="orange" variant="light" icon={<IconInfoCircle size={16} />}>
            These mandates have been rejected and are in a grace period. The user must fulfill these
            mandates to avoid <strong>account blockage</strong>.
          </Alert>

          {renderMandates(
            MandateStatusType.REJECTED_GRACE,
            groupedMandates[MandateStatusType.REJECTED_GRACE]!,
          )}
        </div>
      )}

      {MandateStatusType.REJECTED_OVERDUE in groupedMandates && (
        <div>
          <h4>Rejected &amp; Overdue</h4>
          <Alert color="red" variant="filled" icon={<IconAlertCircle size={16} />}>
            These mandates have been rejected and have exceeded a grace period. They are{" "}
            <strong>blocking the user's account</strong> and preventing any access to Community
            Solutions.
          </Alert>

          {renderMandates(
            MandateStatusType.REJECTED_OVERDUE,
            groupedMandates[MandateStatusType.REJECTED_OVERDUE]!,
          )}
        </div>
      )}

      {MandateStatusType.OPEN_OVERDUE in groupedMandates && (
        <div>
          <h4>Open &amp; Overdue</h4>
          <Alert color="red" variant="filled" icon={<IconAlertCircle size={16} />}>
            <strong>Immediate attention required:</strong>
            These mandates are <strong>blocking the user's account</strong> and preventing any
            access to Community Solutions.
          </Alert>

          {renderMandates(
            MandateStatusType.OPEN_OVERDUE,
            groupedMandates[MandateStatusType.OPEN_OVERDUE]!,
          )}
        </div>
      )}

      {MandateStatusType.ARCHIVED in groupedMandates && (
        <div>
          <h4>Archived</h4>
          <Alert color="green" variant="outline" icon={<IconInfoCircle size={16} />}>
            The following mandates have been fulfilled, checked, and accepted. These mandates are
            archived and do not require any further action.
          </Alert>

          {renderMandates(MandateStatusType.ARCHIVED, groupedMandates[MandateStatusType.ARCHIVED]!)}
        </div>
      )}
    </div>
  );
};

export default UserMandatesProps;
