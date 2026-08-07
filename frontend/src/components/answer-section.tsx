import {
  Card,
  CardProps,
  Button,
  Container,
  TextInput,
  Loader,
  Menu,
  Group,
  Flex,
  Text,
} from "@mantine/core";
import React, { useCallback, useEffect, useState } from "react";
import { getAnswerSection, useRemoveCut } from "../api/hooks/answers";
import { AnswerSchema, AnswerSectionSchema, AnswerKind } from "../api/model";
import { useUser } from "../auth";
import useInitialState from "../hooks/useInitialState";
import AnswerComponent from "./answer";
import IconButton from "./icon-button";
import { getAnswerSectionId } from "../utils/exam-utils";
import useAlmostInViewport from "../hooks/useAlmostInViewport";
import {
  IconArrowsMoveVertical,
  IconChevronDown,
  IconDeviceFloppy,
  IconDots,
  IconEdit,
  IconEye,
  IconEyeOff,
  IconTrash,
} from "@tabler/icons-react";
import classes from "./answer-section.module.css";
import { useDisclosure } from "@mantine/hooks";
import AnswerSectionButtons from "./answer-section-buttons";
import AnswerSectionModal from "./answer-section-overlay";

interface NameCardProps {
  id: string;
  children: React.ReactNode;
}

const NameCard = (props: NameCardProps) => (
  <Card className={classes.nameCard} {...props} shadow="md" id={props.id} />
);

const AnswerSectionButtonWrapper = (props: CardProps) => (
  <Card
    p="sm"
    shadow="md"
    className={classes.answerSectionButtonWrapper}
    {...props}
  />
);

interface AddButtonProps {
  allowAnswer: boolean;
  allowLegacyAnswer: boolean;
  allowOfficialAnswer: boolean;
  draftType: AnswerKind | null;
  onAnswer: () => void;
  onLegacyAnswer: () => void;
  onOfficialAnswer: () => void;
}
const AddButton: React.FC<AddButtonProps> = ({
  allowAnswer,
  allowLegacyAnswer,
  allowOfficialAnswer,
  draftType,
  onAnswer,
  onLegacyAnswer,
  onOfficialAnswer,
}) => {
  const [isOpen, setOpen] = useState(false);
  const toggle = useCallback(() => setOpen(old => !old), []);
  // Count how many types of answers are allowed.
  // If one is allowed, we don't use a dropdown
  const answerTypeCount =
    +allowAnswer + +allowLegacyAnswer + +allowOfficialAnswer;

  if (answerTypeCount >= 2) {
    return (
      <Menu opened={isOpen} withinPortal onChange={toggle}>
        <Menu.Target>
          <Button rightSection={<IconChevronDown />}>Add Answer</Button>
        </Menu.Target>
        <Menu.Dropdown>
          {allowAnswer && (
            <Menu.Item
              onClick={onAnswer}
              disabled={draftType === AnswerKind.personal}
            >
              Add Answer
            </Menu.Item>
          )}
          {allowOfficialAnswer && (
            <Menu.Item
              onClick={onOfficialAnswer}
              disabled={draftType === AnswerKind.official}
            >
              Add Official Answer
            </Menu.Item>
          )}
          {allowLegacyAnswer && (
            <Menu.Item
              onClick={onLegacyAnswer}
              disabled={draftType === AnswerKind.legacy}
            >
              Add Legacy Answer
            </Menu.Item>
          )}
        </Menu.Dropdown>
      </Menu>
    );
  } else {
    return (
      <Group grow>
        {allowAnswer && (
          <Button
            size="sm"
            onClick={onAnswer}
            disabled={draftType === AnswerKind.personal}
          >
            Add Answer
          </Button>
        )}
        {allowOfficialAnswer && (
          <Button
            size="sm"
            onClick={onOfficialAnswer}
            disabled={draftType === AnswerKind.official}
          >
            Add Official Answer
          </Button>
        )}
        {allowLegacyAnswer && (
          <Button
            size="sm"
            onClick={onLegacyAnswer}
            disabled={draftType === AnswerKind.legacy}
          >
            Add Legacy Answer
          </Button>
        )}
      </Group>
    );
  }
};

interface Props {
  oid: number;
  onSectionChange: () => void;
  onToggleHidden: () => void;
  hidden: boolean;
  cutVersion: number;
  setCutVersion: (newVersion: number) => void;
  onHasAnswersChange: () => Promise<void>;
  has_answers: boolean;

  cutName: string;
  onCutNameChange: (newName: string) => void;

  onCancelMove: () => void;
  onMove: () => void;
  isBeingMoved: boolean;

  displayEmptyCutLabels: boolean;
  displayHideShowButtons: boolean;
}

const AnswerSectionComponent: React.FC<Props> = React.memo(
  // See react/display-name (Named functions for display name)
  // eslint-disable-next-line prefer-arrow-callback
  function AnswerSectionComponent({
    oid,
    onSectionChange,
    onToggleHidden,
    hidden,
    setCutVersion,

    cutName,
    onCutNameChange,

    onCancelMove,
    onMove,
    isBeingMoved,

    displayEmptyCutLabels,
    displayHideShowButtons,

    onHasAnswersChange,
    has_answers,
  }) {
    const [data, setData] = useState<AnswerSectionSchema | undefined>();
    const getScore = (answer: AnswerSchema) =>
      answer.expertVotes * 10 + answer.upvotes;
    const run = useCallback(async () => {
      const { value: section } = await getAnswerSection(oid);
      section.answers.sort((a, b) => getScore(b) - getScore(a));
      setData(section);
      setCutVersion(section.cutVersion);
    }, [oid, setCutVersion]);
    const [
      deleteWarningIsOpen,
      { open: openDeleteWarning, close: closeDeleteWarning },
    ] = useDisclosure();
    const { mutate: removeCut } = useRemoveCut({
      mutation: {
        onSuccess: () => {
          if (isBeingMoved) onCancelMove();
          onSectionChange();
        },
      },
    });
    const runRemoveSplit = useCallback(
      () => removeCut({ oid }),
      [removeCut, oid],
    );
    const setAnswerSection = useCallback(
      (newData: AnswerSectionSchema) => {
        setCutVersion(newData.cutVersion);
        setData(newData);
        void run(); // refreshes the data if there's a new answer
      },
      [setCutVersion, run],
    );

    const [visible, containerElement] = useAlmostInViewport<HTMLDivElement>();

    // initial run to get the answers in a section
    useEffect(() => {
      if ((visible || !hidden) && !data) {
        void run();
      }
    }, [run, visible, hidden, data]);

    const [draftType, setDraftType] = useState<AnswerKind | null>(null);
    const onAddAnswer = useCallback(() => {
      setDraftType(AnswerKind.personal);
      if (hidden) onToggleHidden();
    }, [hidden, onToggleHidden]);
    const onAddOfficialAnswer = useCallback(() => {
      setDraftType(AnswerKind.official);
      if (hidden) onToggleHidden();
    }, [hidden, onToggleHidden]);
    const onAddLegacyAnswer = useCallback(() => {
      setDraftType(AnswerKind.legacy);
      if (hidden) onToggleHidden();
    }, [hidden, onToggleHidden]);
    const user = useUser()!;
    const isCatAdmin = user.isCategoryAdmin;

    const [
      hideWarningIsOpen,
      { open: openHideWarning, close: closeHideWarning },
    ] = useDisclosure();
    const hideAnswerSection = async () => {
      await onHasAnswersChange();
      closeHideWarning();
      void run(); // updates data when setting visibility to hidden
    };
    const hideAnswerSectionWithWarning = () => {
      if (data) {
        if (data.answers.length === 0 || !has_answers) {
          void hideAnswerSection();
        } else {
          openHideWarning();
        }
      }
    };

    const [draftName, setDraftName] = useInitialState(cutName);
    const [isEditingName, setIsEditingName] = useState(
      data && cutName.length === 0 && isCatAdmin,
    );
    useEffect(() => {
      if (data && cutName.length === 0 && isCatAdmin) setIsEditingName(true);
    }, [data, isCatAdmin, cutName]);
    const id = getAnswerSectionId(oid, cutName);

    return (
      <div ref={containerElement}>
        <AnswerSectionModal
          isOpen={hideWarningIsOpen}
          onClose={closeHideWarning}
          setHidden={hideAnswerSection}
          title="Hide section?"
          text="This only hides the section without deleting the answers. Use delete if you want to remove them."
          button="Hide Answer Section"
        />
        <AnswerSectionModal
          isOpen={deleteWarningIsOpen}
          onClose={closeDeleteWarning}
          setHidden={runRemoveSplit}
          title="Delete section?"
          text="This deletes the section and the answers contained in it. This cannot be undone."
          button="Delete Answer Section"
        />
        {((cutName && cutName.length > 0) ||
          (isCatAdmin && displayEmptyCutLabels)) && (
          <NameCard id={id}>
            {isEditingName ? (
              <Group>
                <TextInput
                  value={draftName}
                  placeholder="Name"
                  onChange={e => setDraftName(e.target.value)}
                />
                <IconButton
                  variant="filled"
                  tooltip="Save PDF section name"
                  icon={<IconDeviceFloppy />}
                  onClick={() => {
                    setIsEditingName(false);
                    onCutNameChange(draftName);
                  }}
                />
              </Group>
            ) : (
              <Flex justify="space-between" align="center">
                <Text fw={700} m={0}>
                  {cutName}
                </Text>
                {isCatAdmin && (
                  <IconButton
                    variant="filled"
                    tooltip="Edit PDF section name"
                    icon={<IconEdit />}
                    onClick={() => setIsEditingName(true)}
                  />
                )}
              </Flex>
            )}
          </NameCard>
        )}
        <Container fluid py="md" px="md">
          {!hidden && data && (
            <div>
              {data.answers.map(answer => (
                <AnswerComponent
                  key={answer.oid}
                  section={data}
                  answer={answer}
                  onSectionChanged={setAnswerSection}
                  answerKind={answer.kind}
                />
              ))}
              {draftType === AnswerKind.personal && (
                <AnswerComponent
                  section={data}
                  onSectionChanged={setAnswerSection}
                  onDelete={() => setDraftType(null)}
                  answerKind={AnswerKind.personal}
                />
              )}
              {draftType === AnswerKind.official && (
                <AnswerComponent
                  section={data}
                  onSectionChanged={setAnswerSection}
                  onDelete={() => setDraftType(null)}
                  answerKind={AnswerKind.official}
                />
              )}
              {draftType === AnswerKind.legacy && (
                <AnswerComponent
                  section={data}
                  onSectionChanged={setAnswerSection}
                  onDelete={() => setDraftType(null)}
                  answerKind={AnswerKind.legacy}
                />
              )}
            </div>
          )}
          <AnswerSectionButtonWrapper
          // color={isBeingMoved || !has_answers ? "primary" : undefined}
          >
            <div>
              {data === undefined ? (
                <AnswerSectionButtons show_hide={<Loader />} />
              ) : (
                <>
                  <AnswerSectionButtons
                    visibility={
                      displayHideShowButtons ? (
                        <IconButton
                          size="sm"
                          icon={has_answers ? <IconEyeOff /> : <IconEye />}
                          tooltip="Toggle visibility"
                          onClick={hideAnswerSectionWithWarning}
                        />
                      ) : null
                    }
                    cancel_add={
                      isBeingMoved ? (
                        <Button size="sm" onClick={onCancelMove}>
                          Cancel
                        </Button>
                      ) : (
                        (data.answers.length === 0 || !hidden) &&
                        has_answers &&
                        data &&
                        (data.allowNewAnswer ||
                          (data.allowNewLegacyAnswer && isCatAdmin)) && (
                          <AddButton
                            allowAnswer={data.allowNewAnswer}
                            allowLegacyAnswer={
                              data.allowNewLegacyAnswer && isCatAdmin
                            }
                            allowOfficialAnswer={data.allowNewOfficialAnswer}
                            draftType={draftType}
                            onAnswer={onAddAnswer}
                            onLegacyAnswer={onAddLegacyAnswer}
                            onOfficialAnswer={onAddOfficialAnswer}
                          />
                        )
                      )
                    }
                    show_hide={
                      !isBeingMoved &&
                      data.answers.length > 0 && (
                        <Button onClick={onToggleHidden}>
                          {hidden ? "Show Answers" : "Hide Answers"}
                        </Button>
                      )
                    }
                    move={
                      isCatAdmin && (
                        <Menu withinPortal>
                          <Menu.Target>
                            <Button rightSection={<IconChevronDown />}>
                              <IconDots />
                            </Button>
                          </Menu.Target>
                          <Menu.Dropdown>
                            <Menu.Item
                              leftSection={<IconTrash />}
                              onClick={openDeleteWarning}
                            >
                              Delete
                            </Menu.Item>
                            <Menu.Item
                              leftSection={<IconArrowsMoveVertical />}
                              onClick={onMove}
                            >
                              Move
                            </Menu.Item>
                          </Menu.Dropdown>
                        </Menu>
                      )
                    }
                  />
                </>
              )}
            </div>
          </AnswerSectionButtonWrapper>
        </Container>
      </div>
    );
  },
);

export default AnswerSectionComponent;
