function XClose({onClose}) {
    return (
        <div className="mb-6 flex font-bold text-5xl items-end justify-end">
            <i className="fa-solid fa-circle-xmark text-marcelin-900 cursor-pointer" onClick={onClose}></i>
        </div>
    )
};

export default XClose;