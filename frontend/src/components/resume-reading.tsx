import {
  Affix,
  Button,
  CloseButton,
  Group,
  Paper,
  Stack,
  Text,
} from "@mantine/core";
import { IconArrowRight } from "@tabler/icons-react";

interface Props {
  visible: boolean;
  onResume: () => void;
  onDismiss: () => void;
}

export default function ResumeReading({ visible, onResume, onDismiss }: Props) {
  if (!visible) return null;

  return (
    <Affix position={{ top: "40%", right: 16 }}>
      <Paper
        withBorder
        shadow="md"
        radius="md"
        p="md"
        w={300}
        maw="calc(100vw - 32px)"
      >
        <Stack gap="xs">
          <Group justify="space-between">
            <Text fw={600}>Welcome back!</Text>
            <CloseButton
              size="sm"
              aria-label="Dismiss resume reading"
              onClick={onDismiss}
            />
          </Group>
          <Text size="sm" c="dimmed">
            Return to your last viewed page.
          </Text>
          <Button
            rightSection={<IconArrowRight size={16} />}
            onClick={onResume}
          >
            Resume reading
          </Button>
        </Stack>
      </Paper>
    </Affix>
  );
}
