import { useState } from "react";
import { Select, Loader, Group, Text } from "@mantine/core";
import { useDebouncedValue } from "@mantine/hooks";
import { useUser, useUserSearch } from "../api/hooks/users.js";
import type { UserSchema } from "../api/model/userSchema.js";

interface UserSelectProps {
  label: string;
  value: number | undefined;
  // eslint-disable-next-line @typescript-eslint/no-invalid-void-type
  onChange(this: void, user: UserSchema | undefined): void;
}

const UserSelect: React.FC<UserSelectProps> = ({ onChange, value, label }) => {
  const [searchValue, setSearchValue] = useState("");
  const [debouncedSearch] = useDebouncedValue(searchValue, 300);

  const { data: users, isLoading } = useUserSearch({
    q: debouncedSearch,
  });

  const { data: initialUser, isLoading: isInitialLoading } = useUser(value!, {
    query: {
      enabled: value !== undefined && !users?.some(u => u.id === value),
    },
  });

  const selectData =
    users?.map(user => ({
      value: String(user.id),
      label: user.full_name,
      user,
    })) ?? [];

  if (
    initialUser &&
    !selectData.some(user => user.user.id === initialUser.id)
  ) {
    selectData.unshift({
      value: String(initialUser.id),
      label: initialUser.full_name,
      user: initialUser,
    });
  }

  return (
    <Select
      label={label}
      placeholder="Search name or username..."
      searchable
      searchValue={searchValue}
      onSearchChange={value => {
        setSearchValue(value);
      }}
      data={selectData}
      rightSection={isLoading || isInitialLoading ? <Loader size="xs" /> : null}
      // Filter only in backend
      filter={({ options }) => options}
      clearable
      value={value === undefined ? null : String(value)}
      renderOption={({ option }) => {
        const user = (option as unknown as { user: UserSchema }).user;

        return (
          <Group gap="sm">
            <Text size="sm">{user.full_name}</Text>
            <Text size="xs" c="dimmed">
              @{user.username}
            </Text>
          </Group>
        );
      }}
      onChange={(_selectedValue, option) => {
        const user = (option as unknown as { user: UserSchema } | undefined)
          ?.user;
        onChange(user);
      }}
    />
  );
};

export default UserSelect;
