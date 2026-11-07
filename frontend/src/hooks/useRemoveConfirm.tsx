import { useState, useCallback } from "react";
import { Modal, Button, Group, ButtonProps } from "@mantine/core";

interface ButtonPropsOverride {
  propsDict: Partial<ButtonProps>;
  label: string;
}

type CB = () => void;
const useRemoveConfirm = () => {
  const [stack, setStack] = useState<
    [string, CB, CB, ButtonPropsOverride, ButtonPropsOverride, number][]
  >([]);
  const push = useCallback(
    (
      message: string,
      yes: CB,
      no?: CB,
      yesButtonOverrride?: ButtonPropsOverride,
      noButtonOverride?: ButtonPropsOverride,
    ) => {
      setStack(prevStack => [
        ...prevStack,
        [
          message,
          yes,
          no ??
            (() => {
              /* no-op */
            }),
          yesButtonOverrride ?? {
            label: "Remove",
            propsDict: { color: "red" },
          },
          noButtonOverride ?? { label: "Cancel", propsDict: {} },
          Math.random(),
        ],
      ]);
    },
    [],
  );
  const pop = useCallback((key: number) => {
    setStack(prevStack => prevStack.filter(s => s[5] !== key));
  }, []);
  const modals = stack.map(
    ([message, yes, no, yesButtonOverrride, noButtonOverride, key]) => (
      <Modal
        opened={true}
        withCloseButton={false}
        onClose={() => {
          /* no-op */
        }}
        key={key}
      >
        <Modal.Body mt="sm">{message}</Modal.Body>

        <Group justify="right">
          <Button
            {...noButtonOverride.propsDict}
            onClick={() => {
              pop(key);
              no();
            }}
          >
            {noButtonOverride.label}
          </Button>
          <Button
            {...yesButtonOverrride.propsDict}
            onClick={() => {
              pop(key);
              yes();
            }}
          >
            {yesButtonOverrride.label}
          </Button>
        </Group>
      </Modal>
    ),
  );
  return [push, modals] as const;
};
export default useRemoveConfirm;
