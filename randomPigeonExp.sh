#for fraction in 0.1 0.2 0.3 0.4 0.5 0.6 0.7 0.8 0.9
for fraction in 1.0
do
    python randomPigeon.py training_data_7x1 1.0 > training_data_7x1_$fraction
    python train_and_eval.py --training_file training_data_7x1_$fraction --test_dir /homes/urialon/js_test/ --nice2predict_server localhost:5745 --path_length 7 --num_threads 32 --path_width 1
done
