function countSomething(t, x) {
    var c = 0;
    for (var i = 0; i< x.length ; i++) {
        if (x[i] === t) {
            c++;
        }
    }
    return c;
}