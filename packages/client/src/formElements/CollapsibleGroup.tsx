import { Trans, useTranslation } from "react-i18next";
import { FormElementBody, FormElementComponent } from "./FormElement";
import {
  DropdownMenuIcon,
  MinusCircledIcon,
  PlusCircledIcon,
} from "@radix-ui/react-icons";
import fromMarkdown from "./fromMarkdown";
import { useEffect, useState } from "react";
import Warning from "../components/Warning";
import useDialog from "../components/useDialog";
import * as Tooltip from "@radix-ui/react-tooltip";

/**
 * Displays a rich text section
 */
const CollapsibleGroup: FormElementComponent<{
  defaultOpen?: boolean;
}> = (props) => {
  const { t } = useTranslation("admin:surveys");
  const [open, setOpen] = useState(
    props.editable || Boolean(props.componentSettings.defaultOpen)
  );

  useEffect(() => {
    if (props.onCollapse) {
      props.onCollapse(open);
    }
  }, []);

  const { alert } = useDialog();
  return (
    <>
      {!props.editable && (
        <div
          className={`w-full flex items-center h-0 justify-end relative overflow-visible z-10 mt-2`}
          style={{
            minHeight: 28,
          }}
        >
          <div
            onClick={() => {
              setOpen((prev) => !prev);
              if (props.onCollapse) {
                props.onCollapse(!open);
              }
            }}
            className="flex-1 ProseMirrorBody cursor-pointer flex items-center"
          >
            <Tooltip.Provider>
              <Tooltip.Root delayDuration={100}>
                <h2 className="flex-1 select-none flex items-center">
                  {props.body.content[0].content[0].text}
                  {props.collapsibleGroupState?.active ? (
                    <Tooltip.Trigger asChild>
                      <div className="ml-1 mb-0.5 inline-block w-2 h-2 rounded-full bg-primary-500 border"></div>
                    </Tooltip.Trigger>
                  ) : null}
                </h2>
                <Tooltip.Content
                  sideOffset={5}
                  // style={{ maxWidth: 180 }}
                  className="z-50 select-none rounded bg-primary-600 text-white px-2 py-1 shadow text-center text-xs"
                  side="right"
                  align="center"
                >
                  <Tooltip.Arrow className="text-primary-600 fill-current" />
                  <Trans ns="sketching">
                    This group has input values.
                    <br />
                    Click to expand.
                  </Trans>
                </Tooltip.Content>
              </Tooltip.Root>
            </Tooltip.Provider>
            <button className="">
              {open ? (
                <MinusCircledIcon className="w-6 h-6 mx-2 text-primary-500" />
              ) : (
                <PlusCircledIcon className="w-6 h-6 mx-2 text-primary-500" />
              )}
            </button>
          </div>
        </div>
      )}
      <>
        {props.editable && (
          <div style={{ marginTop: -32, marginBottom: 10, zIndex: 5 }}>
            <FormElementBody
              formElementId={props.id}
              isInput={false}
              body={props.body}
              editable={props.editable}
              alternateLanguageSettings={props.alternateLanguageSettings}
              onHeadingClick={() => {
                setOpen(false);
                if (props.onCollapse) {
                  props.onCollapse(false);
                }
              }}
            />
            <div className="-mt-2">
              <button
                onClick={() => {
                  alert(t("How do Collapsible Groups work?"), {
                    description: (
                      <div>
                        <p>
                          Collapsible Groups enable users to hide and show a
                          long list of questions or content. This is useful for
                          organizing content into sections that can be expanded
                          or collapsed.
                        </p>
                        <p>
                          All form elements that are below a Collapsible Group
                          will be controlled by that group, until the next
                          Collapsible Group (or Collapsible Break) is
                          encountered.
                        </p>
                      </div>
                    ),
                  });
                }}
                className="text-xs text-primary-500 underline"
              >
                <Trans ns="admin:sketching">
                  How do Collapsible Groups work?
                </Trans>
              </button>
            </div>
          </div>
        )}
        {props.body.content.length > 1 && props.editable && (
          <Warning level="warning">
            <Trans ns="admin:sketching">
              Extra content beyond the first heading will be ignored for
              Collapsible Groups
            </Trans>
          </Warning>
        )}
      </>
    </>
  );
};

// eslint-disable-next-line i18next/no-literal-string
CollapsibleGroup.defaultBody = fromMarkdown(`
# Group Name
`);

CollapsibleGroup.label = <Trans ns="admin:surveys">Collapsible Group</Trans>;
CollapsibleGroup.description = (
  <Trans ns="admin:surveys">Hide and show elements</Trans>
);

CollapsibleGroup.icon = () => (
  <div className="bg-gray-800 w-full h-full font-bold text-center flex justify-center items-center  italic text-white">
    <DropdownMenuIcon />
  </div>
);

export default CollapsibleGroup;
