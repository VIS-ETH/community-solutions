import { parseISO, lightFormat, differenceInCalendarDays } from "date-fns";
import {
  Alert,
  Anchor,
  Button,
  Divider,
  Group,
  List,
  ListItem,
  Modal,
} from "@mantine/core";
import {
  useCheckMandate,
  useCreateMandate,
  useDeleteMandate,
  useExtendMandate,
  useListMandates,
} from "../api/hooks/mandates";
import useRemoveConfirm from "../hooks/useRemoveConfirm";
import { useUser } from "../auth";
import { MandateSchema } from "../api/model";
import { useDisclosure } from "@mantine/hooks";
import { IconAlertCircle, IconInfoCircle } from "@tabler/icons-react";
import { Link } from "react-router-dom";
import GlobalConsts from "../globalconsts";
import { useListCategoriesOnlyPayment } from "../api/hooks/categories";
import MandateAcceptModal from "./mandate-accept-modal";
import { useState } from "react";

enum MandateStatusType {
  OPEN_ONGOING,
  AWAITING_CHECK,
  OPEN_OVERDUE,
  REJECTED_GRACE,
  REJECTED_OVERDUE,
  ARCHIVED,
}

interface UserMandatesProps {
  username: string;
}

// due_date and grace_until are the last days (UTC) with access
const isPastDate = (date: string) =>
  new Date().toISOString().slice(0, 10) > date;

const getMandateStatusType = (mandate: MandateSchema): MandateStatusType => {
  if (["accepted", "excused"].includes(mandate.checked_state ?? ""))
    return MandateStatusType.ARCHIVED;

  // waiting for an admin never blocks
  if (mandate.fulfilled_at != null && mandate.checked_state == null)
    return MandateStatusType.AWAITING_CHECK;

  if (!isPastDate(mandate.due_date)) {
    return mandate.checked_state === "rejected"
      ? MandateStatusType.REJECTED_GRACE
      : MandateStatusType.OPEN_ONGOING;
  }

  if (
    mandate.checked_state === "rejected" &&
    mandate.grace_until &&
    !isPastDate(mandate.grace_until)
  )
    return MandateStatusType.REJECTED_GRACE;

  if (mandate.checked_state === "rejected")
    return MandateStatusType.REJECTED_OVERDUE;

  return MandateStatusType.OPEN_OVERDUE;
};

const MandateActions: React.FC<{
  mandate: MandateSchema;
  onChanged: () => void;
}> = ({ mandate, onChanged }) => {
  const [confirm, modals] = useRemoveConfirm();
  const options = { mutation: { onSuccess: onChanged } };
  const remove = useDeleteMandate(options);
  const check = useCheckMandate(options);
  const extend = useExtendMandate(options);
  const error = remove.error ?? check.error ?? extend.error;

  const status = getMandateStatusType(mandate);
  const isFinal = ["accepted", "excused"].includes(mandate.checked_state ?? "");
  const isBlocking =
    status === MandateStatusType.OPEN_OVERDUE ||
    status === MandateStatusType.REJECTED_OVERDUE;
  const name = `${mandate.user_display_name}'s mandate for ${mandate.category_display_name}`;

  function onExtendClick() {
    confirm(
      `Extend ${name}? It gives the user 24 hours of access to upload their transcript.`,
      () => extend.mutate({ mandateId: mandate.id }),
      undefined,
      { label: "Extend", propsDict: {} },
    );
  }

  function onExcuseClick() {
    confirm(
      `Excuse ${name}? The user no longer has to upload a transcript. This cannot be undone.`,
      () =>
        check.mutate({
          mandateId: mandate.id,
          data: { checked_state: "excused" },
        }),
      undefined,
      { label: "Excuse", propsDict: { color: "orange" } },
    );
  }

  function onDeleteClick() {
    confirm(`Delete ${name}? This cannot be undone.`, () =>
      remove.mutate({ mandateId: mandate.id }),
    );
  }

  return (
    <>
      {modals}
      <Group gap="xs" mt="xs">
        {isBlocking && (
          <Button
            size="compact-sm"
            variant="light"
            loading={extend.isPending}
            onClick={onExtendClick}
          >
            Extend 24h
          </Button>
        )}
        {!isFinal && (
          <Button
            size="compact-sm"
            variant="light"
            color="orange"
            loading={check.isPending}
            onClick={onExcuseClick}
          >
            Excuse
          </Button>
        )}
        <Button
          size="compact-sm"
          variant="light"
          color="red"
          loading={remove.isPending}
          onClick={onDeleteClick}
        >
          Delete
        </Button>
      </Group>
      {error && (
        <Alert color="red" mt="xs">
          {error.message}
        </Alert>
      )}
    </>
  );
};

const RenderMandates: React.FC<{
  mandates: readonly MandateSchema[];
  onChanged: () => void;
}> = ({ mandates, onChanged }) => {
  return (
    <List>
      {mandates.map(mandate => {
        return (
          <ListItem key={mandate.id}>
            Mandate on category{" "}
            <Anchor component={Link} to={`/category/${mandate.category}`}>
              {mandate.category_display_name}
            </Anchor>
            : signed up for on{" "}
            {lightFormat(mandate.created_at, GlobalConsts.dateFNSFormatString)},
            due on{" "}
            {lightFormat(
              mandate.due_date,
              GlobalConsts.dateFNSFormatStringDate,
            )}
            <br />
            {mandate.checked_state === "excused" && (
              <>The mandate was excused by an administrator.</>
            )}
            {mandate.checked_state === "accepted" && (
              <>
                The mandate was accepted by an administrator on{" "}
                {lightFormat(
                  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                  mandate.checked_at!,
                  GlobalConsts.dateFNSFormatString,
                )}
                , which the user uploaded on
                {lightFormat(
                  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                  mandate.fulfilled_at!,
                  GlobalConsts.dateFNSFormatString,
                )}
                .{" "}
                {mandate.uploaded_transcript ? (
                  <>
                    The document is found at:{" "}
                    <Anchor
                      component={Link}
                      to={`/exams/${mandate.uploaded_transcript}`}
                    >
                      {mandate.uploaded_transcript_display_name}
                    </Anchor>
                    .
                  </>
                ) : (
                  "The document has since been deleted."
                )}
              </>
            )}
            {mandate.fulfilled_at != null && mandate.checked_state == null && (
              <>
                The user uploaded{" "}
                {mandate.uploaded_transcript ? (
                  <Anchor
                    component={Link}
                    to={`/exams/${mandate.uploaded_transcript}`}
                  >
                    {mandate.uploaded_transcript_display_name}
                  </Anchor>
                ) : (
                  "a transcript (since deleted)"
                )}{" "}
                on{" "}
                {lightFormat(
                  mandate.fulfilled_at,
                  GlobalConsts.dateFNSFormatString,
                )}
                , which is waiting to be checked by an administrator.
              </>
            )}
            {mandate.fulfilled_at == null &&
              mandate.checked_state !== "excused" &&
              (isPastDate(mandate.due_date) ? (
                <>
                  Mandate not fulfilled and deadline exceeded by over{" "}
                  {differenceInCalendarDays(
                    new Date(),
                    parseISO(mandate.due_date),
                  )}{" "}
                  days!
                </>
              ) : (
                <>
                  {differenceInCalendarDays(
                    parseISO(mandate.due_date),
                    new Date(),
                  )}{" "}
                  days left to fulfill.
                </>
              ))}
            {mandate.checked_state === "rejected" && (
              <>
                The mandate was last rejected on{" "}
                {lightFormat(
                  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                  mandate.checked_at!,
                  GlobalConsts.dateFNSFormatString,
                )}
                , after being fulfilled on the{" "}
                {lightFormat(
                  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                  mandate.fulfilled_at!,
                  GlobalConsts.dateFNSFormatString,
                )}
                . It needs to be amended until{" "}
                {lightFormat(
                  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                  mandate.grace_until!,
                  GlobalConsts.dateFNSFormatString,
                )}
                .<br />
              </>
            )}
            {mandate.extended_until &&
              new Date(mandate.extended_until) > new Date() && (
                <>
                  <br />
                  Extended until{" "}
                  {lightFormat(
                    mandate.extended_until,
                    GlobalConsts.dateFNSFormatString,
                  )}
                  : the mandate does not block the account until then.
                </>
              )}
            {mandate.can_manage && (
              <MandateActions mandate={mandate} onChanged={onChanged} />
            )}
          </ListItem>
        );
      })}
    </List>
  );
};

const UserMandatesProps: React.FC<UserMandatesProps> = userProps => {
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const user = useUser()!;
  const {
    error: mandatesError,
    data: mandates,
    refetch: reloadMandates,
  } = useListMandates({
    username: userProps.username,
  });

  const [pendingCategory, setPendingCategory] = useState<{
    slug: string;
    displayname: string;
    mandate_due_date: string;
  } | null>(null);
  const {
    error: categoriesError,
    data: categories,
    refetch: reloadCategories,
  } = useListCategoriesOnlyPayment();
  const {
    error: addError,
    isPending: addingMandate,
    mutate: addMandate,
  } = useCreateMandate({
    mutation: {
      onSuccess() {
        void reloadMandates();
        void reloadCategories();
      },
      onSettled() {
        setPendingCategory(null);
      },
    },
  });
  const error = mandatesError ?? addError ?? categoriesError;
  const [
    addMandateModalIsOpen,
    { open: openAddMandateModal, close: closeAddMandateModal },
  ] = useDisclosure();

  if (!user.isCategoryAdmin && userProps.username !== user.user?.username) {
    throw new Error("You are not authorized to view this user's mandates.");
  }

  const groupedMandates = Object.groupBy(mandates ?? [], mandate =>
    getMandateStatusType(mandate),
  );

  const isMyself = userProps.username === user.user?.username;
  const takenCategories = new Set(mandates?.map(mandate => mandate.category));
  const addableCategories = categories?.filter(
    cat => !takenCategories.has(cat.slug) && (isMyself || cat.can_manage),
  );

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
        title="Add mandate for category"
      >
        Select a category to add a mandate. An added mandate will require you to{" "}
        <strong>actively contribute</strong> in order for Community Solutions as
        a whole (all solutions + exams and other documents) to remain
        accessible.
        <br />
        In particular, failure to fulfill a mandate will result in your{" "}
        <strong>account</strong> being <strong>blocked</strong> and you will not
        be able to access any solutions or exams until the mandate is fulfilled.
        <Divider my="md" />
        Select the category:
        <List>
          {addableCategories?.map(cat => (
            <ListItem key={cat.slug}>
              <Button
                onClick={() => {
                  setPendingCategory(cat);
                  closeAddMandateModal();
                }}
                variant="subtle"
              >
                {cat.displayname}
              </Button>
            </ListItem>
          ))}
        </List>
      </Modal>

      <MandateAcceptModal
        opened={pendingCategory !== null}
        onClose={() => setPendingCategory(null)}
        loading={addingMandate}
        categoryDisplayname={pendingCategory?.displayname}
        dueDate={pendingCategory?.mandate_due_date}
        onAccept={() =>
          pendingCategory &&
          addMandate({
            data: {
              username: userProps.username,
              category: pendingCategory.slug,
            },
          })
        }
      />

      {MandateStatusType.OPEN_ONGOING in groupedMandates && (
        <div>
          <h4>Open &amp; ongoing</h4>
          <Alert
            color="green"
            variant="light"
            icon={<IconInfoCircle size={16} />}
            mb="md"
          >
            These mandates are currently open and ongoing. During this period,
            the user has access to Community Solutions including the mandated
            categories and is expected to fulfill the mandate before its due
            date.
          </Alert>

          <RenderMandates
            onChanged={() => void reloadMandates()}
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            mandates={groupedMandates[MandateStatusType.OPEN_ONGOING]!}
          />
        </div>
      )}

      {MandateStatusType.AWAITING_CHECK in groupedMandates && (
        <div>
          <h4>Awaiting check</h4>
          <Alert
            color="blue"
            variant="light"
            icon={<IconInfoCircle size={16} />}
            mb="md"
          >
            The user has uploaded a transcript for these mandates, which an
            administrator still needs to check. Waiting for the check never
            blocks the user&apos;s account, even after the due date.
          </Alert>

          <RenderMandates
            onChanged={() => void reloadMandates()}
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            mandates={groupedMandates[MandateStatusType.AWAITING_CHECK]!}
          />
        </div>
      )}

      {MandateStatusType.REJECTED_GRACE in groupedMandates && (
        <div>
          <h4>Rejected &amp; Grace period</h4>
          <Alert
            color="orange"
            variant="light"
            icon={<IconInfoCircle size={16} />}
          >
            These mandates have been rejected and are in a grace period. The
            user must fulfill these mandates to avoid{" "}
            <strong>account blockage</strong>.
          </Alert>

          <RenderMandates
            onChanged={() => void reloadMandates()}
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            mandates={groupedMandates[MandateStatusType.REJECTED_GRACE]!}
          />
        </div>
      )}

      {MandateStatusType.REJECTED_OVERDUE in groupedMandates && (
        <div>
          <h4>Rejected &amp; Overdue</h4>
          <Alert
            color="red"
            variant="filled"
            icon={<IconAlertCircle size={16} />}
          >
            These mandates have been rejected and have exceeded a grace period.
            They are <strong>blocking the user's account</strong> and preventing
            any access to Community Solutions, unless an administrator extends
            them.
          </Alert>

          <RenderMandates
            onChanged={() => void reloadMandates()}
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            mandates={groupedMandates[MandateStatusType.REJECTED_OVERDUE]!}
          />
        </div>
      )}

      {MandateStatusType.OPEN_OVERDUE in groupedMandates && (
        <div>
          <h4>Open &amp; Overdue</h4>
          <Alert
            color="red"
            variant="filled"
            icon={<IconAlertCircle size={16} />}
          >
            <strong>Immediate attention required:</strong>
            These mandates are <strong>blocking the user's account</strong> and
            preventing any access to Community Solutions, unless an
            administrator extends them.
          </Alert>

          <RenderMandates
            onChanged={() => void reloadMandates()}
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            mandates={groupedMandates[MandateStatusType.OPEN_OVERDUE]!}
          />
        </div>
      )}

      {MandateStatusType.ARCHIVED in groupedMandates && (
        <div>
          <h4>Archived</h4>
          <Alert
            color="green"
            variant="outline"
            icon={<IconInfoCircle size={16} />}
          >
            The following mandates have been accepted or excused by an
            administrator. They are archived and do not require any further
            action.
          </Alert>

          <RenderMandates
            onChanged={() => void reloadMandates()}
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            mandates={groupedMandates[MandateStatusType.ARCHIVED]!}
          />
        </div>
      )}
    </div>
  );
};

export default UserMandatesProps;
