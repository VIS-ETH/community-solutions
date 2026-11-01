import { Card, Text, Progress, Anchor, Stack, Tooltip } from "@mantine/core";
import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { authenticated, login } from "../api/fetch-utils";
import { useUser } from "../auth";
import { SearchResult } from "../hooks/useSearch";
import { highlight } from "../utils/search-utils";
import { clsx } from "clsx";
import classes from "../utils/focus-outline.module.css";
import IconButton from "./icon-button";
import { IconPin, IconPinnedFilled } from "@tabler/icons-react";
import { ListCategoriesWithMetaResponse } from "../api/model";
import {
  useDeleteCategoryPin,
  useSetCategoryPin,
} from "../api/hooks/categories";

interface Props {
  category:
    | SearchResult<ListCategoriesWithMetaResponse>
    | ListCategoriesWithMetaResponse;
  reload: () => void;
}
const CategoryCard: React.FC<Props> = ({ category, reload }) => {
  const navigate = useNavigate();
  const loggedIn = useUser()?.loggedin ?? false;
  const handleKeyDown = (e: React.KeyboardEvent<HTMLElement>) => {
    if (e.code === "Enter") {
      if (!authenticated()) login(`/category/${category.slug}`);
      else void navigate(`/category/${category.slug}`);
    }
  };
  const { mutate: markCategoryPinned } = useSetCategoryPin({
    mutation: {
      onSuccess: reload,
    },
  });
  const { mutate: unmarkCategoryUserPinned } = useDeleteCategoryPin({
    mutation: {
      onSuccess: reload,
    },
  });

  const handleTogglePinned = (event: React.SyntheticEvent) => {
    event.stopPropagation();
    event.preventDefault();

    if (category.pinned) {
      unmarkCategoryUserPinned({ slug: category.slug });
    } else {
      markCategoryPinned({ slug: category.slug });
    }

    reload();
  };
  return (
    <Card
      component={Link}
      to={`/category/${category.slug}`}
      onClick={e => {
        if (!authenticated()) {
          e.preventDefault();
          login(`/category/${category.slug}`);
        }
      }}
      withBorder
      pos="relative"
      px="lg"
      py="md"
      className={clsx(classes.focusOutline, classes.hoverShadow)}
      tabIndex={0}
      onKeyDown={handleKeyDown}
    >
      {loggedIn && (
        <IconButton
          pos="absolute"
          top={8}
          right={8}
          size="md"
          variant="transparent"
          color="gray"
          tooltip={category.pinned ? "Unpin category" : "Pin category"}
          icon={category.pinned ? <IconPinnedFilled /> : <IconPin />}
          onClick={handleTogglePinned}
        />
      )}
      <Stack h="100%" justify="space-between">
        <div className="category-card" id={category.slug}>
          <Anchor
            component="span"
            fw={700}
            size="xl"
            tabIndex={-1}
            mb={0}
            pr={24}
            lh={1.25}
            lineClamp={3}
          >
            {"match" in category
              ? highlight(category.displayname, category.match)
              : category.displayname}
          </Anchor>
          <Text mt={4}>{`Exams: ${category.examcountpublic}`}</Text>
          <Text mb={4}>{`Documents: ${category.documentcount}`}</Text>
        </div>
        <Tooltip
          label={`Answers: ${((category.answerprogress * 100) | 0).toString()} %`}
        >
          <Progress radius={0} value={category.answerprogress * 100} />
        </Tooltip>
      </Stack>
    </Card>
  );
};
export default CategoryCard;
