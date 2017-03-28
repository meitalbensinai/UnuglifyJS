if [ $# -lt 2 ]
    then
        echo "Usage: script-glove.sh <length> <width>"
        exit 1
fi
length=4
width=1

python extract_features_to_glove_test.py --dir /homes/urialon/js_test --max_path_length ${length} --max_path_width ${width} > glove_models/js_test${length}x${width}.txt 2> paths-nohup.out
#cd ../glove/
#./uridemo.sh ${length} ${width}
