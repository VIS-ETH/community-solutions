import { useQueryClient } from "@tanstack/react-query";
import {
  getListFaqEntriesQueryKey,
  useAddFaqEntry,
  useRemoveFaqEntry,
  useListFaqEntries,
  useUpdateFaqEntry,
  useSwapFaqEntries,
} from "./hooks/faq";
import type { FaqEntry } from "./model";

// Lower order comes first. As a tiebreaker, entry with lower id comes first
const sorted = (arg: FaqEntry[]) =>
  arg.sort((a, b) => a.order - b.order || a.oid - b.oid);

export const useFaq = () => {
  const queryClient = useQueryClient();
  const faqEntries = useListFaqEntries({
    query: {
      select: data => data.value,
    },
  });

  function setQueryData(faqs: FaqEntry[]) {
    queryClient.setQueryData(getListFaqEntriesQueryKey(), {
      value: sorted(faqs),
    });
  }

  const addFaq = useAddFaqEntry({
    mutation: {
      onSuccess(data) {
        if (faqEntries.data) {
          setQueryData([...faqEntries.data, data.value]);
        } else {
          void faqEntries.refetch();
        }
      },
    },
  });
  const updateFaq = useUpdateFaqEntry({
    mutation: {
      onSuccess(data) {
        if (faqEntries.data) {
          const filtered = faqEntries.data.filter(
            s => s.oid !== data.value.oid,
          );
          setQueryData([...filtered, data.value]);
        } else {
          void faqEntries.refetch();
        }
      },
    },
  });
  const removeFaq = useRemoveFaqEntry({
    mutation: {
      onSuccess() {
        void faqEntries.refetch();
      },
    },
  });

  const swapFaq = useSwapFaqEntries({
    mutation: {
      onSuccess() {
        void faqEntries.refetch();
      },
    },
  });

  function runAddFaq(question: string, answer: string, order: number) {
    addFaq.mutate({
      data: {
        question,
        answer,
        order,
      },
    });
  }

  function runUpdateFaq(id: number, changes: Partial<FaqEntry>) {
    updateFaq.mutate({
      id,
      data: {
        answer: changes.answer ?? null,
        question: changes.question ?? null,
        order: changes.order ?? null,
      },
    });
  }

  function runRemoveFaq(id: number) {
    removeFaq.mutate({ id });
  }

  function runSwapFaq(a: FaqEntry, b: FaqEntry) {
    swapFaq.mutate({
      idA: a.oid,
      idB: b.oid,
    });
  }

  return {
    faqs: faqEntries.data,
    add: runAddFaq,
    update: runUpdateFaq,
    swap: runSwapFaq,
    remove: runRemoveFaq,
  } as const;
};
