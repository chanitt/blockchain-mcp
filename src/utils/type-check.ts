function checkValidHexadecimal(str: string):boolean{
    return !/^0x[0-9A-Fa-f]*$/.test(str)
}


export default checkValidHexadecimal;