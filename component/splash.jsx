import { StyleSheet, Text, View, Image, StatusBar } from 'react-native'
import React from 'react'

const splash = () => {
    return (
        <View style={styles.container}>
            <StatusBar barStyle="light-content" backgroundColor="#000000" />
            <Image
                style={styles.Icon}
                source={require("../Images/amigoIcon.png")}
            />
            <Text style={styles.icontext}>Make friends through sharing</Text>
        </View >
    )
}

export default splash

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#000000',
        flexDirection: 'column',
        justifyContent:"center",
        alignItems:"center"
    },
    Icon: {
        resizeMode: "contain",
        width: 200,
        height: 200,
        opacity:100,
    },
    icontext: {
        fontSize:20,
        letterSpacing:1,
        lineHeight:34,
        color: "#fff",
        fontWeight:310,
        position:"absolute",
        bottom:80,
        alignSelf:"center",
        textShadowColor:"rgba(0,0,0,0.15)",
        textShadowOffset:{width:0, height:2},
        textShadowRadius:4,
    }
    })