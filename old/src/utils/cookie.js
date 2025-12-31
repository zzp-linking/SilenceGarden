function getsec(str)
	{
	var str1=str.substring(0, str.length - 1) * 1;
	var str2=str.substring(str.length - 1, str.length).toLowerCase();
	if (str2=="s")
	{
	return str1*1000;
	}
	else if (str2=="h")
	{
	return str1*60*60*1000;
	}
	else if (str2=="d")
	{
	return str1*24*60*60*1000;
	}
}
export const CookieUtils = {
	get: function (name) {
		var arr,reg=new RegExp("(^| )"+name+"=([^;]*)(;|$)");
		if(arr=document.cookie.match(reg))
		return unescape(arr[2]);
		else
		return null;
	},
	del: function (name) {
		var exp = new Date();
		exp.setTime(exp.getTime() - 1);
		var cval= this.get(name);
		if(cval != null)
		document.cookie= name + "="+cval+";expires="+exp.toGMTString();
	},
	set: function (name, value, time) {
		if (time) {
			var strsec = getsec(time);
			var exp = new Date();
			exp.setTime(exp.getTime() + strsec*1);
			document.cookie = name + "="+ escape(value) + ";expires=" + exp.toGMTString();
		} else{
			document.cookie= name + "=" + escape(value)
		}
		
	}
}
