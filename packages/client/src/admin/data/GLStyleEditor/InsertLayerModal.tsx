import { Trans } from "react-i18next";
import Modal from "../../../components/Modal";
import { InsertLayerOption } from "./extensions/glStyleAutocomplete";
import { useMemo } from "react";

export default function InsertLayerModal({
  onRequestClose,
  options,
  onSelect,
}: {
  onRequestClose: () => void;
  options: InsertLayerOption[];
  onSelect: (option: InsertLayerOption) => void;
}) {
  const { types } = useMemo(() => {
    const types: string[] = [];
    options.forEach((option) => {
      if (!types.includes(option.type)) {
        types.push(option.type);
      }
    });
    return { types };
  }, [options]);

  return (
    <Modal
      onRequestClose={onRequestClose}
      open={true}
      scrollable={true}
      dark
      zeroPadding
    >
      <div className="px-4">
        <h1 className="text-lg font-bold">
          <Trans ns="admin:data">Insert Layer</Trans>
        </h1>
        <div className="flex flex-col">
          {Array.from(types).map((type) => (
            <div>
              <h2 className="text-base font-bold">{type}</h2>
              <ul>
                {options
                  .filter((option) => option.type === type)
                  .map((option) => (
                    <li>
                      <button
                        className="text-left w-full"
                        onClick={() => {
                          onSelect(option);
                        }}
                      >
                        {option.label} {option.propertyChoice?.property}
                      </button>
                    </li>
                  ))}{" "}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </Modal>
  );
}
