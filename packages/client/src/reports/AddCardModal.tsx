import { useTranslation } from "react-i18next";
import Modal from "../components/Modal";
import { getAvailableCardTypes, getCardRegistration } from "./registerCard";
import { ReportConfiguration } from "./cards/cards";
import { CheckIcon } from "@heroicons/react/solid";

interface AddCardModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (cardType: string) => void;
  report?: ReportConfiguration;
}

export function AddCardModal({
  isOpen,
  onClose,
  onSelect,
  report,
}: AddCardModalProps) {
  const { t } = useTranslation("admin:sketching");

  const availableCardTypes = getAvailableCardTypes();

  // Get all card types currently in use across all tabs
  const usedCardTypes = new Set<string>();
  if (report?.tabs) {
    report.tabs.forEach((tab) => {
      tab.cards?.forEach((card) => {
        usedCardTypes.add(card.type);
      });
    });
  }

  return (
    <Modal
      open={isOpen}
      onRequestClose={onClose}
      title={t("Add a Card")}
      autoWidth
      disableBackdropClick={true}
      footerClassName="border-t"
      zeroPadding={true}
      footer={[
        {
          label: t("Cancel"),
          onClick: onClose,
          variant: "secondary",
        },
      ]}
    >
      <div className="space-y-4 flex flex-col">
        <p className="text-sm text-gray-500 flex-none px-6">
          {t("Choose a card type to add to the current tab.")}
        </p>

        {/* Cards Grid */}
        <div className="grid grid-cols-1 gap-3 bg-gray-100 p-4 flex-1 border-t w-128">
          {availableCardTypes.map((cardType) => {
            const registration = getCardRegistration(cardType);
            if (!registration) return null;

            const IconComponent = registration.icon;
            const isAlreadyUsed = usedCardTypes.has(cardType);

            return (
              <div
                key={cardType}
                role="button"
                className="bg-white rounded-lg p-4 hover:outline outline-blue-500 cursor-pointer transition-colors duration-150 relative"
                onClick={() => {
                  onSelect(cardType);
                  onClose();
                }}
              >
                {/* Checkmark indicator for already used cards */}
                {isAlreadyUsed && (
                  <div className="absolute top-3 right-3 w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center shadow-sm">
                    <CheckIcon className="w-3 h-3 text-white" />
                  </div>
                )}

                <div className="flex items-center space-x-4">
                  <div className="flex-shrink-0 w-8 h-8 rounded overflow-hidden">
                    <IconComponent
                      componentSettings={registration.defaultSettings}
                      sketchClass={null}
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-base font-medium text-gray-800">
                      {registration.label}
                    </div>
                    <div className="text-sm text-gray-600 mt-1">
                      {registration.description}
                    </div>
                    {isAlreadyUsed && (
                      <div className="text-xs text-blue-600 mt-1">
                        {t("Already in use")}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Empty State */}
        {availableCardTypes.length === 0 && (
          <div className="text-center py-8">
            <div className="text-gray-400 mb-4">
              <svg
                className="w-12 h-12 mx-auto"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
            </div>
            <p className="text-gray-500">{t("No card types available.")}</p>
          </div>
        )}
      </div>
    </Modal>
  );
}
