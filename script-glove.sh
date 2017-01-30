if [ $# -lt 2 ]
    then
        echo "Usage: script-glove.sh <length> <width>"
        exit 1
fi
length=$1
width=$2

python extract_features_to_glove.py --dir /homes/urialon/jsnice_training_clean/ --max_path_length ${length} --max_path_width ${width} > glove_models/jsnice_training_clean${length}x${width}.txt 2> paths-nohup.out
cd ../glove/
./uridemo.sh ${length} ${width}
