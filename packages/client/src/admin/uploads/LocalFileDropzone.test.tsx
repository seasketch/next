/* eslint-disable i18next/no-literal-string */
import { describe, expect, it, jest } from "@jest/globals";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import LocalFileDropzone from "./LocalFileDropzone";
import { DATA_TABLE_FILE_ACCEPT, pickDataTableDrop } from "./uploadFileTypes";

function dropFiles(node: HTMLElement, files: File[]) {
  const dataTransfer = {
    files,
    items: files.map((file) => ({
      kind: "file",
      type: file.type,
      getAsFile: () => file,
    })),
    types: ["Files"],
  };
  fireEvent.dragEnter(node, { dataTransfer });
  fireEvent.dragOver(node, { dataTransfer });
  fireEvent.drop(node, { dataTransfer });
}

describe("LocalFileDropzone", () => {
  it("does not present the drop area as a button", () => {
    render(
      <LocalFileDropzone
        accept={DATA_TABLE_FILE_ACCEPT}
        onFiles={() => {}}
        label="Drop a CSV to add a data table"
      >
        <p>Browse area</p>
      </LocalFileDropzone>
    );

    expect(
      screen.getByLabelText("Drop a CSV to add a data table")
    ).not.toHaveAttribute("role", "button");
  });

  it("forwards a dropped CSV to the caller", async () => {
    const onFiles = jest.fn<(files: File[]) => void>();
    render(
      <LocalFileDropzone
        accept={DATA_TABLE_FILE_ACCEPT}
        onFiles={onFiles}
        label="Drop a CSV to add a data table"
      >
        <p>Browse area</p>
      </LocalFileDropzone>
    );

    const file = new File(["id,n\n1,2"], "sites.csv", { type: "text/csv" });
    dropFiles(
      screen.getByLabelText("Drop a CSV to add a data table"),
      [file]
    );

    await waitFor(() => {
      expect(onFiles).toHaveBeenCalled();
    });
    const dropped = onFiles.mock.calls[0][0];
    expect(pickDataTableDrop(dropped).ok).toBe(true);
  });

  it("reports drag state to onDragStateChange", async () => {
    const onDragStateChange = jest.fn();
    const file = new File(["id\n1"], "sites.csv", { type: "text/csv" });
    render(
      <LocalFileDropzone
        accept={DATA_TABLE_FILE_ACCEPT}
        onFiles={() => {}}
        onDragStateChange={onDragStateChange}
        label="Drop a CSV to add a data table"
        dragClassName=""
      >
        <p>Browse area</p>
      </LocalFileDropzone>
    );

    const node = screen.getByLabelText("Drop a CSV to add a data table");
    fireEvent.dragEnter(node, {
      dataTransfer: {
        files: [file],
        items: [
          {
            kind: "file",
            type: file.type,
            getAsFile: () => file,
          },
        ],
        types: ["Files"],
      },
    });

    await waitFor(() => {
      expect(onDragStateChange).toHaveBeenCalledWith(
        expect.objectContaining({ isDragActive: true })
      );
    });
  });

  it("does not forward drops while disabled", () => {
    const onFiles = jest.fn<(files: File[]) => void>();
    render(
      <LocalFileDropzone
        accept={DATA_TABLE_FILE_ACCEPT}
        disabled
        onFiles={onFiles}
        label="Drop a CSV to add a data table"
      >
        <p>Browse area</p>
      </LocalFileDropzone>
    );

    dropFiles(screen.getByLabelText("Drop a CSV to add a data table"), [
      new File(["id\n1"], "sites.csv", { type: "text/csv" }),
    ]);
    expect(onFiles).not.toHaveBeenCalled();
  });
});
