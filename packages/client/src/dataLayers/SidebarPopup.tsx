import { AnimatePresence, motion } from "framer-motion";

require("./sidebar-popup.css");

export default function SidebarPopup(props: { content?: string, title?: string; onClose: () => void }) {
  return (
    <AnimatePresence>
      {props.content && <motion.div
        transition={{ duration: 0.2, ease: "easeInOut" }}
        initial={{ opacity: 0, translateX: 200 }}
        animate={{ opacity: 1, translateX: 0 }}
        exit={{ opacity: 0, translateX: 200 }}
        className="sidebar-popup z-20 absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
        <div className="w-72 sm:w-96 bg-white text-sm h-full  pointer-events-auto shadow-xl flex flex-col right-0 absolute">
          <div className="flex items-center p-4 py-2 bg-gray-100 border-b">
            <h3 className="flex-1 truncate text-lg font-light">{props.title}</h3>
            <button onClick={props.onClose} className="flex-none bg-gray-400 hover:bg-gray-500   rounded-full p-1 cursor-pointer focus:ring-blue-300"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" className="w-5 h-5 text-white"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg></button>
          </div>

          <div className="p-4 overflow-y-auto flex-1" dangerouslySetInnerHTML={{ __html: props.content }} />
        </div>
      </motion.div>}

    </AnimatePresence>
  )
}