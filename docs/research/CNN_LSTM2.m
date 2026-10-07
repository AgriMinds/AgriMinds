
load WaveformData.mat
data(1:4);
numChannels = size(data{1},1)
% 
figure
tiledlayout(2,2)
for i = 1:4
    nexttile
    stackedplot(data{i}',DisplayLabels="Channel " + (1:numChannels));
    title("Observation " + i)
    xlabel("Time Step")
end
options = trainingOptions("adam", ...
    MaxEpochs=200, ...
    SequencePaddingDirection="left", ...
    Shuffle="every-epoch", ...
    Plots="training-progress", ...
    Verbose=0);

numObservations = numel(data);
XTrain = data(1:floor(0.9*numObservations));
XValidation = data(floor(0.9*numObservations)+1:end);

numDownsamples = 2;

sequenceLengths = zeros(1,numel(XTrain));

for n = 1:numel(XTrain)
    X = XTrain{n};
    cropping = mod(size(X,2), 2^numDownsamples);
    X(:,end-cropping+1:end) = [];
    XTrain{n} = X;
    sequenceLengths(n) = size(X,2);
end

for n = 1:numel(XValidation)
    X = XValidation{n};
    cropping = mod(size(X,2),2^numDownsamples);
    X(:,end-cropping+1:end) = [];
    XValidation{n} = X;
end

minLength = min(sequenceLengths);
filterSize = 7;
numFilters = 16;
dropoutProb = 0.2;

layers = sequenceInputLayer(numChannels,Normalization="zscore",MinLength=minLength);

for i = 1:numDownsamples
    layers = [
        layers
        convolution1dLayer(filterSize,(numDownsamples+1-i)*numFilters,Padding="same",Stride=2)
        reluLayer
        dropoutLayer(dropoutProb)];
end

for i = 1:numDownsamples
    layers = [
        layers
        transposedConv1dLayer(filterSize,i*numFilters,Cropping="same",Stride=2)
        reluLayer
        dropoutLayer(dropoutProb)];
end

layers = [
    layers
    transposedConv1dLayer(filterSize,numChannels,Cropping="same")
    regressionLayer];

net = trainNetwork(XTrain,XTrain,layers,options);

YValidation = predict(net,XValidation);

MAEValidation = zeros(numel(XValidation),1);
for n = 1:numel(XValidation)
    X = XValidation{n};
    Y = YValidation{n};
    MAEValidation(n) = mean(abs(Y - X),'all');
end

figure
histogram(MAEValidation)
xlabel("Mean Absolute Error (MAE)")
ylabel("Frequency")
title("Representative Samples")

MAEbaseline = max(MAEValidation)

XNew = XValidation;


numAnomalousSequences = 20;
idx = randperm(numel(XValidation),numAnomalousSequences);

for i = 1:numAnomalousSequences
    X = XNew{idx(i)};

    idxPatch = 50:60;
    XPatch = X(:,idxPatch);
    X(:,idxPatch) = 4*abs(XPatch);

    XNew{idx(i)} = X;
end

YNew = predict(net,XNew);


MAENew = zeros(numel(XNew),1);
for n = 1:numel(XNew)
    X = XNew{n};
    Y = YNew{n};
    MAENew(n) = mean(abs(Y - X),'all');
end

figure
histogram(MAENew)
xlabel("Mean Absolute Error (MAE)")
ylabel("Frequency")
title("New Samples")
hold on
xline(MAEbaseline,"r--")
legend(["Data" "Baseline MAE"])

[~,idxTop] = sort(MAENew,"descend");
idxTop(1:10)

X = XNew{idxTop(1)};
Y = YNew{idxTop(1)};

figure
t = tiledlayout(numChannels,1);
title(t,"Sequence " + idxTop(1))

for i = 1:numChannels
    nexttile

    plot(X(i,:))
    box off
    ylabel("Channel " + i)

    hold on
    plot(Y(i,:),"--")
end

nexttile(1)
legend(["Original" "Reconstructed"])

MAE = mean(abs(Y - X),1);

windowSize = 7;
thr = 1.1*MAEbaseline;

idxAnomaly = false(1,size(X,2));
for t = 1:(size(X,2) - windowSize + 1)
    idxWindow = t:(t + windowSize - 1);

    if all(MAE(idxWindow) > thr)
        idxAnomaly(idxWindow) = true;
    end
end

figure
t = tiledlayout(numChannels,1);
title(t,"Anomaly Detection ")

for i = 1:numChannels
    nexttile
    plot(X(i,:));
    ylabel("Channel " + i)
    box off
    hold on

    XAnomalous = nan(1,size(X,2));
    XAnomalous(idxAnomaly) = X(i,idxAnomaly);
    plot(XAnomalous,"r",LineWidth=3)
    hold off
end

xlabel("Time Step")

nexttile(1)
legend(["Input" "Anomalous"])
%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%

% % Load and preprocess data
% clc; clear; close all;
% B= xlsread('afar_time.xlsx');
% t=B(:,1);% annual (year)
% co2=B(:,2);%carbondayoxid (ppm)
% ch4=B(:,3);%methene(ppb)
% no2=B(:,4);%nitrojen oxide (ppb)
% sf6=B(:,5);%sulfer yexaoxid (ppt)
% e=B(:,6);%evaporation (mm)
% olr=B(:,7);%outgoing longwave radiation(J/m^2)
% x=B(:,8);%air temperature(k)
% % x = linspace(0, 10, 100)'; % Feature (100 samples)
% y = 3 * x + 5 + randn(size(x)); % Target with some noise
% 
% inputData = B(:, 1:end-1); % Features
% targetData = B(:, end);    % Target variable
% % Normalize data
% numclasses = 7;
% 
% 
% %%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
% %%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%555
% [inputData, mu, sigma] = zscore(inputData); % Standardize features
% targetData = (targetData - mean(targetData)) / std(targetData); % Standardize target
% % Split data into training and testing sets
% % Split data into training and testing sets
% trainRatio = 0.8;
% numTrain = floor(trainRatio * size(inputData, 1));
% XTrain = inputData(1:numTrain, :);
% YTrain = targetData(1:numTrain);
% XTest = inputData(numTrain+1:end, :);
% YTest = targetData(numTrain+1:end);
% % Reshape data for CNN-LSTM
% % CNN expects 3D input: [timeSteps, features, channels]
% xTrain = reshape(XTrain, [size(XTrain, 1), size(XTrain, 2), 1]);
% 
% xTest = reshape(XTest, [size(XTest, 1), size(XTest, 2), 1]);
% size(xTest);
% % Define CNN-LSTM architecture
% layers = [
%     sequenceInputLayer(size(xTrain, 2))
%     convolution1dLayer(3, 16, 'Padding', 'same') % 1D CNN layer
%     batchNormalizationLayer
%     reluLayer
%     lstmLayer(50, 'OutputMode', 'last') % LSTM layer
%     fullyConnectedLayer(1) % Output layer
%     regressionLayer];
% % Specify training options
% options = trainingOptions('adam', ...
%     'MaxEpochs', 50, ...
%     'MiniBatchSize', 32, ...
%     'InitialLearnRate', 0.001, ...
%     'ValidationData', {xTest, YTest}, ...
%     'Plots', 'training-progress', ...
%     'Verbose', false);
% % Train the model
% net = trainNetwork(xTrain, YTrain, layers, options);