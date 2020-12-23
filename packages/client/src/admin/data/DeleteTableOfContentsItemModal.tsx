import React, { useState } from 'react';
import Button from '../../components/Button';
import Modal from '../../components/Modal';
import { ClientTableOfContentsItem } from '../../dataLayers/tableOfContents/TableOfContents';
import { useDeleteBranchMutation } from '../../generated/graphql';

export default function DeleteTableOfContentsItemModal(props: {item?: ClientTableOfContentsItem, onRequestClose?: () => void, onDelete?: () => void}) {
  const [mutation, mutationState] = useDeleteBranchMutation();
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<Error>();
  const onRequestClose = () => {
    if (!deleting && props.onRequestClose) {
      setError(undefined);
      props.onRequestClose();
    }
  }
  return <Modal onRequestClose={onRequestClose} open={!!props.item}>
    <h2 className="text-lg font-semibold">Delete {props.item?.title}</h2>
    <div className="mt-2 text-md text-gray-500">
      <p>
      Are you sure you want to delete { props.item?.isFolder ? "this folder? Items contained will also be deleted." : "this layer?"}
      </p>
      { error && <p className="text-red-900 mt-2">Error: {error.message}</p>}
    </div>
    <div className="mt-5">
      <Button disabled={deleting} onClick={onRequestClose} className="mr-2" label="Cancel" />
      <Button disabled={deleting} autofocus={true} primary={true} loading={deleting} onClick={async () => {
        setError(undefined);
        setDeleting(true);
        try {
          await mutation({variables: {
            id: props.item!.id as number
          }});
          if (props.onDelete) {
            await props.onDelete();
          }
          setDeleting(false);
          onRequestClose();
        } catch(e) {
          setError(e);
          setDeleting(false);
        }
      }} label="Delete" />
    </div>
  </Modal>
}