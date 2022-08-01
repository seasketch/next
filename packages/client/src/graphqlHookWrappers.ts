import {
  ApolloError,
  Reference,
  StoreObject,
  useMutation,
} from "@apollo/client";
import { DocumentNode, SelectionSetNode } from "graphql";
import { useGlobalErrorHandler } from "./components/GlobalErrorHandler";

export function useDelete<Mutation>(document: DocumentNode) {
  const onError = useGlobalErrorHandler();
  const { mutationName, subjectName, kind } = getDocumentDetails(document);
  const [mutate] = useMutation(document, {
    onError,
    optimisticResponse: (data) => {
      return {
        __typename: "Mutation",
        [mutationName]: {
          __typename: mutationName[0].toUpperCase() + mutationName.slice(1),
          [subjectName]: {
            __typename: kind,
            ...data,
          },
        },
      };
    },
    update: (cache, { data }, options) => {
      let id: number | undefined = options.variables?.id;
      if (!id) {
        throw new Error(
          "id variable must be provided in order to use useDelete"
        );
      }
      cache.evict({
        id: cache.identify({ __typename: kind, id }),
      });
    },
  });
  return (obj: StoreObject | Reference) => mutate({ variables: obj });
}

export function useCreate<Mutation, Variables>(
  document: DocumentNode,
  options: {
    addToLists?: (
      data: Mutation
    ) => { ref: StoreObject | Reference; prop: string }[];
    onError?: (e: ApolloError) => void;
    optimisticDefaults?: Partial<Variables>;
  }
) {
  let generatedId = 999999999999;
  const { mutationName, subjectName, kind, selectionSet } =
    getDocumentDetails(document);
  const onError = useGlobalErrorHandler();
  const [mutate, mutationState] = useMutation(document, {
    onError: options.onError || onError,
    update: (cache, { data }) => {
      if (options.addToLists) {
        const items = options.addToLists(data);
        for (const { ref, prop } of items) {
          const id = cache.identify(ref);
          if (id) {
            cache.modify({
              id,
              fields: {
                [prop](existingRefs = []) {
                  const newRef = cache.writeFragment(
                    getData(data, mutationName, subjectName, kind, selectionSet)
                  );
                  return [...existingRefs, newRef];
                },
              },
            });
          }
        }
      }
    },
    optimisticResponse: (data) => {
      return {
        __typename: "Mutation",
        [mutationName]: {
          __typename: mutationName[0].toUpperCase() + mutationName.slice(1),
          [subjectName]: {
            __typename: kind,
            id: generatedId++,
            ...data,
            ...options.optimisticDefaults,
          },
        },
      };
    },
  });

  return (variables: Variables) => {
    return mutate({ variables });
  };
}

function getData(
  data: any,
  mutationName: string,
  subjectName: string,
  kind: string,
  selectionSet: SelectionSetNode
): { data: any; fragment: DocumentNode } {
  const fragment = {
    kind: "Document",
    definitions: [
      {
        kind: "FragmentDefinition",
        name: {
          kind: "Name",
          value: "_",
        },
        typeCondition: {
          kind: "NamedType",
          name: {
            kind: "Name",
            value: kind,
          },
        },
        directives: [],
        selectionSet,
      },
    ],
  } as DocumentNode;
  return {
    data: data[mutationName][subjectName],
    fragment,
  };
}

function getDocumentDetails(document: DocumentNode) {
  if (document.definitions[0].kind === "OperationDefinition") {
    const firstDef = document.definitions[0];
    const selection = firstDef.selectionSet.selections[0];
    if (selection.kind === "Field") {
      const mutationName = selection.name.value;
      if (
        !selection.selectionSet ||
        selection.selectionSet.selections.length === 0
      ) {
        throw new Error(
          `${mutationName} does not have a selectionSet or it is empty`
        );
      }
      const subselect = selection.selectionSet.selections[0];
      if (subselect.kind !== "Field") {
        throw new Error(
          `${mutationName}'s first selectionSet item is not a field`
        );
      }
      const subjectName = subselect.name.value;
      const kind = subjectName[0].toUpperCase() + subjectName.slice(1);
      return {
        mutationName,
        subjectName,
        kind,
        selectionSet: subselect.selectionSet!,
      };
    } else {
      throw new Error(
        "First selection in mutation definition is not a Field type"
      );
    }
  } else {
    throw new Error("First definition is not OperationDefinition");
  }
}
