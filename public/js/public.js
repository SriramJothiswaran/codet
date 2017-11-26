var app = angular.module('iotApp',[]);

app.controller('mainCtrl', function ($scope,$http) {
    $scope.tempShow = false;
    $scope.appearChange = function(){
        $scope.tempShow = true;
        $http({
            method: 'POST',
            url: '/data'
        }).then(function successCallback(response) {
            console.log('post success');

        }, function errorCallback(response) {
            // called asynchronously if an error occurs
            // or server returns response with an error status.
        });

    }
});
